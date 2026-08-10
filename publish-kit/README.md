# Game Publish Kit · 新游戏即插即用发布流水线

把 The Long Silence 已验证的「爱发电 $1 付费 + 自助解锁」整套基础设施抽成模板。
**任何新游戏复制本目录即可复用，无需重新摸索。**

架构：

```
玩家 ──付款──▶ 爱发电 (afdian.com) ──▶ 拿到订单号
                │
                │ webhook(大陆→Vercel 可能 SSL 失败，非关键)
                ▼
GitHub Pages 静态游戏 ──输入订单号──▶ Vercel /api/afdian-verify
                                        │ 1. 查本地 Supabase 已付款记录
                                        │ 2. 未命中 → 反向调爱发电 query-order API 核实
                                        ▼
                                  Supabase afdian_orders 表
```

核心设计：**拉模式兜底**。webhook 推送可能因大陆→Vercel 网络不通而收不到，
但 verify 端点跑在 Vercel（大陆外），可以主动反向调用爱发电 API 核实订单，让自助解锁不依赖 webhook。

---

## 每款游戏需要改的东西（标 `CHANGEME`）

| 文件 | 改动 |
|---|---|
| `.env.example` | 填爱发电 token、plan_id、DATABASE_URL |
| `.github/workflows/deploy.yml` | `VITE_AFDIAN_VERIFY_URL` 换成你的 Vercel 域名 |
| `api/afdian-verify.ts` | 无需改（逻辑通用），如多方案可加 `AFDIAN_PLAN_ID` |
| `src/afdian-redeem.ts` | `verifyUrl` 已从 `VITE_AFDIAN_VERIFY_URL` 读取，解锁函数 `unlock` 换成游戏自己的实现 |
| 游戏本体 | 试玩关数 `TRIAL_LEVELS`、购买链接 `PURCHASE_URL`、付费状态存储 key |

---

## 从零到上线：7 步

### 1. 创建爱发电 $1 方案
- 登录 https://afdian.com → 创作中心 → 方案管理 → 新建方案「完整版 $1」（≈¥7）
- 方案里写清楚：付款后拿**订单号**，在游戏内输入即自动解锁（无需联系作者）
- 记下：`user_id`（开发者后台顶部）、`plan_id`（方案页）、生成 `token`（开发者后台）

### 2. 建 Supabase 数据库
- https://supabase.com 新建项目
- SQL Editor 里整段粘贴运行 `db/schema.sql`（建 `afdian_orders` 表，幂等可重复跑）
- Project Settings → Database → Connection string
  - **Vercel 用 Transaction pooler**（端口 `6543`）那份连接串，serverless 下连接池更稳

### 3. 建 Vercel 项目并注入 env
- https://vercel.com 新建项目，导入仓库（或 `npx vercel` CLI）
- 关键：仓库根目录的 `.vercelignore` 已排除 `.git / node_modules / dist / 大资源`，
  避免上传超大超时（The Long Silence 曾因 895MB 失败）
- 配 4 个环境变量（Production）：
  ```
  AFDIAN_USER_ID=你的user_id
  AFDIAN_TOKEN=你的token
  AFDIAN_PLAN_ID=你的plan_id
  DATABASE_URL=postgresql://...（Transaction pooler）
  ```
- 部署完成得到域名，如 `https://my-game.vercel.app`

### 4. 配置爱发电 webhook（可选，锦上添花）
- 后台 → 开发者 → webhook 地址填 `https://my-game.vercel.app/api/afdian-webhook`
- 点「发送测试」，期望返回 `{"ec":200}`
- ⚠️ 若测试报 SSL 错误（error_code:35）属正常：大陆服务器连不上 Vercel。
  不影响玩家解锁——verify 端点的拉模式兜底。webhook 收到就记库加速，收不到玩家照样能解锁。

### 5. 前端接入自助解锁
- 复制 `src/afdian-redeem.ts` 到游戏项目
- 游戏里放三个元素：
  ```html
  <input id="redeem-input" placeholder="输入激活码 或 爱发电订单号">
  <button id="redeem-btn">兑换</button>
  <span id="redeem-msg"></span>
  ```
- 逻辑（已封装）：
  - 输入 `14 位以上纯数字` → 当作爱发电订单号 → `GET {VERIFY_URL}?order=xxx` → `ok` 则解锁
  - 否则 → 当作激活码 → 走 `validateActivationCode`
  - 解锁状态存 `localStorage`，解锁后开放全部关卡/内容
- 部署时把 `VITE_AFDIAN_VERIFY_URL` 注入构建（见第 6 步）

### 6. GitHub Pages 部署
- 复制 `.github/workflows/deploy.yml`，把 `VITE_AFDIAN_VERIFY_URL` 改为你的 Vercel 域名
- GitHub 仓库 → Settings → Pages → Source 选 **GitHub Actions**
- push 到 `main` 自动构建部署

### 7. 验证上线
- 打开 `https://<你>.github.io/<game>/`
- 输入假订单号（14+ 位数字）→ 应显示 **「订单未找到或未付款」** → 证明跨域链路通
- 真实爱发电付款 → 输入订单号 → **「✓ 解锁成功！」** → 完整版内容全开

---

## 常见问题

**Q: 玩家输入订单号提示"激活码无效"？**
不是 bug。旧版逻辑错误地把订单号失败也显示成"激活码无效"；新版已修：
订单号分支失败会显示具体原因（订单未找到或未付款 / 验证失败 / 网络错误）。
如果线上还是旧文案，清浏览器缓存或强刷（`Ctrl+Shift+R`）。

**Q: webhook 后台发送测试报 SSL 错误怎么办？**
不用处理。这是大陆→Vercel 的链路问题，webhook 是加速项不是必需项。
verify 端点会主动调爱发电 API 核实，玩家解锁不受影响。

**Q: 每个游戏一个 Vercel 项目 / Supabase 库？**
推荐独立，隔离干净。user_id/token 是同一爱发电账号共用，plan_id 每款游戏不同
（verify 端点按 `AFDIAN_PLAN_ID` 校验方案匹配，防止用 A 游戏的订单解锁 B 游戏）。

**Q: 不想暴露 verify 端点给任意人查任意订单？**
当前实现只返回「某订单是否已付款」这种只读信息，`Access-Control-Allow-Origin: *`。
订单号本身是 14+ 位随机数，穷举成本高；真要更严可加频率限制（本模板未含）。
