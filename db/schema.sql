-- ============================================================
-- The Long Silence · Paddle 履约数据库 schema
-- 用于镜像 Paddle 订阅/客户状态，支撑 webhook 履约与客户门户。
--
-- 用法：psql "$DATABASE_URL" -f db/schema.sql
-- 可重复执行（幂等）。
-- ============================================================

-- 客户表
CREATE TABLE IF NOT EXISTS customers (
  customer_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 订阅表
CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  status TEXT NOT NULL,
  price_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  scheduled_change_action TEXT,
  scheduled_change_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 索引：按客户查订阅（门户用）
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer
  ON subscriptions (customer_id);

-- ============================================================
-- 访问判定辅助函数
--
-- 规则：
--  - status = 'active' 或 'trialing' → 授予付费访问
--  - 存在 scheduled_change（如 cancel/pause）→ 不吊销访问，
--    只有 status 真正变为 'canceled' 才吊销
--  - paused / past_due 按业务规则处理（这里按需调整）
-- ============================================================
CREATE OR REPLACE FUNCTION subscription_grants_access(
  p_status TEXT,
  p_scheduled_change_action TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- active / trialing 都授予访问
  IF p_status = 'active' OR p_status = 'trialing' THEN
    RETURN TRUE;
  END IF;
  -- 注意：scheduled_change 只是"计划中"的变更，不吊销访问
  -- 只有 status 真正为 canceled 时返回 FALSE
  IF p_status = 'canceled' THEN
    RETURN FALSE;
  END IF;
  -- paused / past_due 按业务规则：这里默认不授予（可调整）
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 便捷查询：某客户当前是否有有效订阅
CREATE OR REPLACE FUNCTION customer_has_active_access(p_customer_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  has_access BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.customer_id = p_customer_id
      AND subscription_grants_access(s.status, s.scheduled_change_action)
  ) INTO has_access;
  RETURN has_access;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 爱发电（Afdian）订单表
-- 玩家在爱发电购买 ¥8 完整版后，webhook 记录已付款订单；
-- 玩家在游戏内输入订单号，由 api/afdian-verify 校验并授权解锁。
-- ============================================================
CREATE TABLE IF NOT EXISTS afdian_orders (
  out_trade_no TEXT PRIMARY KEY,
  buyer_user_id TEXT,
  plan_id TEXT,
  amount TEXT,
  status INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
