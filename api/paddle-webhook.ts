/**
 * Paddle Webhook 履约层（Vercel Serverless）。
 *
 * 职责：
 *  1. 用 Paddle SDK 验证 webhook 签名（未验证通过 → 不返回 2xx，让 Paddle 重试）
 *  2. 路由到 typed handlers：subscription.created/updated/canceled、
 *     customer.created/updated、transaction.completed
 *  3. 幂等 upsert（按 Paddle ID 作为主键，不盲插）
 *  4. 镜像订阅/客户状态到数据库
 *
 * 环境变量：
 *  - PADDLE_ENV             : 'live' | 'sandbox'（必须显式设置）
 *  - PADDLE_WEBHOOK_SECRET   : webhook 签名密钥（不是 API key）
 *  - DATABASE_URL            : Postgres 连接串
 *
 * 注意：务必用原始请求体验证（await req.text()），不要先 JSON.parse。
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Environment, Paddle } from '@paddle/paddle-node-sdk'
import { Pool } from 'pg'

// ---- 环境校验：未设置就报错，绝不静默默认 ----
function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

function getPaddle(): Paddle {
  const envStr = process.env.PADDLE_ENV
  if (envStr !== 'live' && envStr !== 'sandbox') {
    throw new Error('PADDLE_ENV must be "live" or "sandbox" (explicitly set)')
  }
  return new Paddle(requireEnv('PADDLE_API_KEY'), {
    environment: envStr === 'live' ? Environment.LIVE : Environment.SANDBOX,
  })
}

let pool: Pool | null = null
function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: requireEnv('DATABASE_URL') })
  return pool
}

// ---- 幂等 upsert 辅助 ----
async function upsertCustomer(p: Pool, data: any) {
  const id = data?.id
  const email = data?.email
  if (!id || !email) return
  await p.query(
    `INSERT INTO customers (customer_id, email)
     VALUES ($1, $2)
     ON CONFLICT (customer_id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()`,
    [id, email],
  )
}

async function upsertSubscription(p: Pool, data: any) {
  const id = data?.id
  const customerId = data?.customer_id
  const status = data?.status
  const priceId = data?.items?.[0]?.price?.id
  const productId = data?.items?.[0]?.price?.product_id
  const scheduledChange = data?.scheduled_change
  if (!id || !customerId || !status) return
  await p.query(
    `INSERT INTO subscriptions (subscription_id, customer_id, status, price_id, product_id, scheduled_change_action, scheduled_change_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (subscription_id) DO UPDATE SET
       status = EXCLUDED.status,
       price_id = COALESCE(EXCLUDED.price_id, subscriptions.price_id),
       product_id = COALESCE(EXCLUDED.product_id, subscriptions.product_id),
       scheduled_change_action = EXCLUDED.scheduled_change_action,
       scheduled_change_at = EXCLUDED.scheduled_change_at,
       updated_at = NOW()`,
    [
      id,
      customerId,
      status,
      priceId ?? null,
      productId ?? null,
      scheduledChange?.action ?? null,
      scheduledChange?.effective_at ? new Date(scheduledChange.effective_at).toISOString() : null,
    ],
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 关键：用原始 body 文本验证，不 JSON.parse
    const rawBody = await new Promise<string>((resolve, reject) => {
      let data = ''
      req.on('data', (chunk) => (data += chunk))
      req.on('end', () => resolve(data))
      req.on('error', reject)
    })
    const signature = (req.headers['paddle-signature'] as string) || ''

    const secret = process.env.PADDLE_WEBHOOK_SECRET
    if (!secret) throw new Error('Missing PADDLE_WEBHOOK_SECRET')
    const paddle = getPaddle()

    // 签名验证：失败则返回 4xx，让 Paddle 重试（不吞掉）
    let event: any
    try {
      event = paddle.webhooks.unmarshal(rawBody, secret, signature)
    } catch (e) {
      console.error('[webhook] signature verification failed', (e as Error).message)
      return res.status(400).json({ error: 'Invalid signature' })
    }

    const eventType: string = event?.eventType
    console.log(`[webhook] ${eventType} id=${event?.eventId}`)

    const p = getPool()
    const data = event?.data

    // 路由到 typed handlers（幂等 upsert）
    switch (eventType) {
      case 'customer.created':
      case 'customer.updated':
        await upsertCustomer(p, data)
        break
      case 'subscription.created':
      case 'subscription.updated':
      case 'subscription.canceled':
      case 'subscription.activated':
      case 'subscription.past_due':
      case 'subscription.paused':
        await upsertSubscription(p, data)
        break
      case 'transaction.completed':
        // 交易完成：确保客户已入库（transaction 通常带 customer）
        await upsertCustomer(p, data?.customer)
        console.log(`[webhook] transaction.completed customer=${data?.customer?.id} total=${data?.totals?.total}`)
        break
      default:
        // 其他事件安全忽略
        console.log(`[webhook] ignored event type: ${eventType}`)
    }

    return res.status(200).json({ received: true })
  } catch (e) {
    console.error('[webhook] handler error', (e as Error).message)
    // 内部错误 → 500，让 Paddle 重试
    return res.status(500).json({ error: 'Internal error' })
  }
}
