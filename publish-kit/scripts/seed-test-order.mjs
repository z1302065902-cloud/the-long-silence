#!/usr/bin/env node
/**
 * 往 Supabase 插入一条"已付款"测试订单，用于端到端验证自助解锁。
 *
 * 用法：
 *   DATABASE_URL='postgresql://...' AFDIAN_PLAN_ID='dfc3acfa...' node seed-test-order.mjs [订单号]
 *
 * 订单号默认用纯数字（游戏前端正则要求 14+ 位纯数字），可传自定义。
 * 验证后建议删除测试数据（见下方 DELETE 注释）。
 */
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('缺 DATABASE_URL 环境变量')
  process.exit(1)
}
const planId = process.env.AFDIAN_PLAN_ID || ''
const orderNo = process.argv[2] || '20260811123456789012'
if (!/^\d{14,}$/.test(orderNo)) {
  console.warn('⚠️ 订单号建议用 14+ 位纯数字（游戏前端正则要求），当前含字母会被当激活码：', orderNo)
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
try {
  await client.connect()
  await client.query(
    `INSERT INTO afdian_orders (out_trade_no, buyer_user_id, plan_id, amount, status)
     VALUES ($1, 'testuser', $2, '7.00', 2)
     ON CONFLICT (out_trade_no) DO UPDATE SET status = 2`,
    [orderNo, planId],
  )
  console.log('✅ 已插入测试订单：', orderNo, 'plan_id:', planId || '(空)')
  console.log('现在在游戏里输入该订单号，应显示「✓ 解锁成功！」')
} catch (e) {
  console.error('插入失败：', e.message)
} finally {
  await client.end()
}

// 验证后清理：把下面取消注释再跑一次
// await client.connect()
// await client.query(`DELETE FROM afdian_orders WHERE out_trade_no = $1`, [orderNo])
// console.log('已删除测试订单')
