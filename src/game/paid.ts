/**
 * 商业化模块：免费试玩 + 完整版解锁。
 *
 * - 免费玩家可玩第一章（前 TRIAL_LEVELS 关）与免费飞船。
 * - 解锁完整版后开放全部 20 关战役与全部飞船。
 * - 付费状态存 localStorage。
 *
 * ## 支付模式（通过 config 切换）
 *
 * | 模式 | 配置 | 说明 |
 * |---|---|---|
 * | `mock` | `PAY_MODE='mock'`（默认） | 600ms 模拟成功，方便开发/测试走通流程 |
 * | `stripe-payment-link` | `STRIPE_PAYMENT_LINK='https://buy.stripe.com/...'` | 跳转到 Stripe 托管的 Payment Link 支付页；返回时带 `?payment=success` 解锁 |
 * | `redirect` | `PURCHASE_URL='https://...'` | 跳转到任意购买页（可填支付宝/微信/自建商城链接）；返回时带 `?payment=success` 解锁 |
 *
 * ## 真实支付验证说明
 *
 * 纯前端（GitHub Pages）无法安全验证支付结果——任何前端解锁都可被绕过。
 * 生产环境建议：
 * 1. 用 Stripe Checkout（服务端生成 session，支付后 webhook 校验），或
 * 2. 自建极简后端（Cloudflare Worker / Vercel 函数）做支付验证并签发解锁 token。
 * 当前实现面向静态站：使用 Payment Link + 返回参数解锁，适合起步，但
 * 「完整性验证」请在正式商业化前升级为服务端校验。
 */

const STORAGE_KEY = 'tls-paid-v1'

/** 免费试玩关卡数（第一章 · 边境试炼）。 */
export const TRIAL_LEVELS = 5

/** ===== 支付配置（部署时在此填写） ===== */

/** 支付模式：'mock' | 'stripe-payment-link' | 'redirect' */
const PAY_MODE: 'mock' | 'stripe-payment-link' | 'redirect' = 'mock'

/** Stripe Payment Link（https://dashboard.stripe.com/payment-links 创建） */
const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/test_xxx'

/** 任意购买页 URL（支付宝/微信/自建商城等） */
const PURCHASE_URL = ''

/** 成功后重定向回来的标识参数名 */
const SUCCESS_PARAM = 'payment'

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
  return readSave().fullVersion
}

/** 当前可玩的最大关卡数（付费=20，试玩=TRIAL_LEVELS）。 */
export function maxPlayableLevel(): number {
  return isFullVersion() ? 20 : TRIAL_LEVELS
}

/**
 * 请求购买完整版。
 *
 * 根据 PAY_MODE：
 * - mock：600ms 后直接解锁
 * - stripe-payment-link：跳转到 Stripe 托管支付页
 * - redirect：跳转到配置的购买页
 *
 * 对于跳转模式，本函数返回 Promise<false>（页面即将跳转），
 * 支付完成后浏览器回到本站（带 ?payment=success），由
 * initPurchaseFlow() 在页面加载时检测并解锁。
 */
export async function requestPurchase(): Promise<boolean> {
  if (PAY_MODE === 'mock') {
    return new Promise((resolve) => {
      window.setTimeout(() => {
        unlockFullVersion()
        resolve(true)
      }, 600)
    })
  }

  if (PAY_MODE === 'stripe-payment-link') {
    const url = new URL(STRIPE_PAYMENT_LINK)
    // 传一个 return_url 让 Stripe 支付后跳回本站并带成功标记
    const returnUrl = `${window.location.origin}${window.location.pathname}?${SUCCESS_PARAM}=success`
    url.searchParams.set('prefilled_email', '')
    // Payment Link 的 return_url 通过 redirect 参数控制；这里用通用方式
    window.location.href = `${url.toString()}&redirect=${encodeURIComponent(returnUrl)}`
    return Promise.resolve(false)
  }

  if (PAY_MODE === 'redirect') {
    const returnUrl = `${window.location.origin}${window.location.pathname}?${SUCCESS_PARAM}=success`
    const sep = PURCHASE_URL.includes('?') ? '&' : '?'
    window.location.href = `${PURCHASE_URL}${sep}return_url=${encodeURIComponent(returnUrl)}`
    return Promise.resolve(false)
  }

  // 未知模式：回退 mock
  return new Promise((resolve) => {
    window.setTimeout(() => {
      unlockFullVersion()
      resolve(true)
    }, 600)
  })
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
    if (params.get(SUCCESS_PARAM) === 'success') {
      unlockFullVersion()
      // 清理 URL 参数，避免刷新重复触发
      const clean = `${window.location.pathname}${window.location.hash}`
      window.history.replaceState({}, '', clean)
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}
