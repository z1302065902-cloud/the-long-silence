/**
 * 客户门户端点（Vercel Serverless）。
 *
 * 流程：
 *  1. 验证用户已认证（从会话解析用户身份 —— 绝不信客户端传的 customer ID）
 *  2. 从数据库查询该用户的 Paddle customer_id（及订阅）
 *  3. 用 Paddle SDK mint 一个客户门户会话
 *  4. 重定向到 Paddle 托管的门户 URL（用户可在其中改支付方式、取消、看发票）
 *
 * 环境变量：
 *  - PADDLE_ENV, PADDLE_API_KEY（服务端）
 *  - DATABASE_URL
 *  - SESSION_SECRET（用于验证会话）
 *
 * 依赖认证机制：当前用一个简单的 Authorization: Bearer <session-token>。
 * 生产环境请对接你的真实认证（如 Supabase Auth / Clerk / 自建）。
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, timingSafeEqual } from 'crypto'
import { Environment, Paddle } from '@paddle/paddle-node-sdk'
import { Pool } from 'pg'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

let pool: Pool | null = null
function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: requireEnv('DATABASE_URL') })
  return pool
}

/**
 * 从会话 token 解析用户标识。
 * 这里用 HMAC 签名的 token（SESSION_SECRET）模拟：token 格式 <userId>.<hmac>。
 * 生产环境替换为你的真实认证解析。
 */
function resolveUserFromToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length)
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [userId, sig] = parts
  const expected = createHmac('sha256', requireEnv('SESSION_SECRET')).update(userId).digest('hex')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  return timingSafeEqual(a, b) ? userId : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // 1. 验证认证（优先服务端，绝不信任客户端传的 customer id）
    const userId = resolveUserFromToken(req.headers.authorization)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    // 2. 从数据库查该用户的 Paddle customer_id
    //    约定：users 表有一个 paddle_customer_id 列，或通过 email 关联 customers 表。
    //    这里以 customers.email = users.email 关联（需要你调整到实际 schema）。
    const p = getPool()
    const userRes = await p.query('SELECT email FROM users WHERE id = $1', [userId])
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' })
    const email = userRes.rows[0].email as string

    const custRes = await p.query('SELECT customer_id FROM customers WHERE email = $1', [email])
    if (custRes.rows.length === 0) {
      return res.status(404).json({ error: 'No Paddle account linked' })
    }
    const customerId = custRes.rows[0].customer_id as string

    // 3. Mint Paddle 门户会话
    const envStr = process.env.PADDLE_ENV
    if (envStr !== 'live' && envStr !== 'sandbox') {
      throw new Error('PADDLE_ENV must be "live" or "sandbox"')
    }
    const paddle = new Paddle(requireEnv('PADDLE_API_KEY'), {
      environment: envStr === 'live' ? Environment.LIVE : Environment.SANDBOX,
    })
    const session = await paddle.customerSessions.create({ customer_id: customerId })

    // 4. 重定向到 Paddle 门户
    const portalUrl = session.urls?.general?.actions?.[0]?.href
    if (!portalUrl) return res.status(502).json({ error: 'Portal URL not returned' })

    return res.status(200).json({ url: portalUrl })
  } catch (e) {
    console.error('[portal] error', (e as Error).message)
    return res.status(500).json({ error: 'Internal error' })
  }
}
