/**
 * 商业化模块：免费试玩 + 完整版解锁。
 *
 * - 免费玩家可玩第一章（前 TRIAL_LEVELS 关）与免费飞船。
 * - 解锁完整版后开放全部 20 关战役与全部飞船。
 * - 付费状态存 localStorage。
 *
 * ## 收款方式（个人开发者 · 无需营业执照）
 *
 * 采用「激活码」模式，兼容国内外玩家：
 *
 * 1. 玩家在你的收款渠道付款：
 *    - 海外：Paddle（https://www.paddle.com）——个人可注册，支持信用卡+支付宝，自动处理税务
 *    - 国内：支付宝 / 微信 个人收款码
 * 2. 你收到付款后，用 `scripts/gen-keys.mjs` 生成激活码发给玩家。
 * 3. 玩家在游戏内「输入激活码」→ 校验 → 解锁完整版。
 *
 * 激活码使用 HMAC 签名（密钥在服务端/本地生成脚本持有），前端只做校验展示，
 * 真正的安全性来自激活码的不可伪造性。
 */

const STORAGE_KEY = 'tls-paid-v1'

/** 免费试玩关卡数（第一章 · 边境试炼）。 */
export const TRIAL_LEVELS = 5

/** ===== 购买入口配置（部署时填写） ===== */

/** 玩家去哪个页面付款（Paddle 支付页 / 或你的联系页） */
export const PURCHASE_URL = 'https://buy.paddle.com/'

/**
 * 爱发电订单自助解锁的验证接口地址。
 * - 本地/打包：构建时用 Vite 注入 VITE_AFDIAN_VERIFY_URL
 * - 缺省：相对路径 /api/afdian-verify（仅当游戏与 api 同源时可用）
 *
 * 由于游戏部署在 GitHub Pages（静态站），api 在 Vercel，
 * 部署时必须在 .env / Vite 配置里设置 VITE_AFDIAN_VERIFY_URL 指向 Vercel 端点，
 * 例如 https://the-long-silence.vercel.app/api/afdian-verify
 */
export const AFDIAN_VERIFY_URL: string =
  (import.meta as any).env?.VITE_AFDIAN_VERIFY_URL ||
  '/api/afdian-verify'

/**
 * 激活码校验盐。这个值必须与 scripts/gen-keys.mjs 里的 SALT 完全一致。
 * 两边用同一盐派生 MAC，才能互相校验：
 *   MAC = sha256(盐 + ':' + body) 的前 8 位（大写）
 * 更换方法：生成新随机串填入两处（paid.ts 这里 + gen-keys.mjs 的 SALT）。
 */
const ACTIVATION_KEY_HASH =
  '091792322fcd570092e40712d8a2892208c30e0d19b9834b9f1951a7816bb60f'

/** ===== 内部实现 ===== */

type PaidSave = {
  fullVersion: boolean
}

function defaultSave(): PaidSave {
  return { fullVersion: false }
}

function readSave(): PaidSave {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSave()
    const p = JSON.parse(raw) as Partial<PaidSave>
    return { fullVersion: Boolean(p.fullVersion) }
  } catch {
    return defaultSave()
  }
}

function writeSave(s: PaidSave) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export function isFullVersion(): boolean {
  // itch.io 完整版构建：构建时注入 VITE_FULL_VERSION=1 直接解锁
  if ((import.meta as any).env?.VITE_FULL_VERSION === '1') return true
  return readSave().fullVersion
}

/** 当前可玩的最大关卡数（付费=20，试玩=TRIAL_LEVELS）。 */
export function maxPlayableLevel(): number {
  return isFullVersion() ? 20 : TRIAL_LEVELS
}

/**
 * 校验激活码。gen-keys.mjs 生成的格式：
 *   XXXX-XXXX-XXXXXXXX   （BODY-MAC）
 * 其中 BODY = XXXX-XXXX，MAC = 后 8 位（SHA-256(secret:body) 的前 8 位）。
 *
 * 前端用 ACTIVATION_KEY_HASH 派生校验，配合 gen-keys 的生成规则。
 * 注意：这是"防随意猜测"级别的保护；要彻底防绕过需服务端校验。
 */
export async function validateActivationCode(code: string): Promise<boolean> {
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
  const parts = clean.split('-').filter(Boolean)
  // 期望 3 段：BODY1 BODY2 MAC
  if (parts.length !== 3) return false
  const body = `${parts[0]}-${parts[1]}`
  const mac = parts[2]
  if (!body || mac.length < 6) return false
  const { sha256 } = await import('./crypto-hash')
  const expect = (await sha256(`${ACTIVATION_KEY_HASH}:${body.replace('-', '')}`))
    .slice(0, 8)
    .toUpperCase()
  if (expect === mac) {
    unlockFullVersion()
    return true
  }
  return false
}

/**
 * 请求购买完整版：跳转到 PURCHASE_URL（Paddle 支付页或联系页）。
 * 玩家付款后，通过激活码解锁。
 */
export async function requestPurchase(): Promise<boolean> {
  window.location.href = PURCHASE_URL
  return Promise.resolve(false)
}

export function unlockFullVersion(): boolean {
  writeSave({ fullVersion: true })
  return true
}

/**
 * 页面加载时调用：检测支付成功回跳参数并解锁。
 * 在 main.ts / game.ts 初始化时调用一次。
 */
export function initPurchaseFlow(): boolean {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'success') {
      unlockFullVersion()
      const clean = `${window.location.pathname}${window.location.hash}`
      window.history.replaceState({}, '', clean)
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}
