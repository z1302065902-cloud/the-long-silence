/**
 * 商业化模块：免费试玩 + 完整版解锁。
 *
 * - 免费玩家可玩第一章（前 TRIAL_LEVELS 关）与免费飞船。
 * - 解锁完整版后开放全部 20 关战役与全部飞船。
 * - 付费状态存 localStorage；接入真实支付时替换 requestPurchase 的实现。
 */

const STORAGE_KEY = 'tls-paid-v1'

/** 免费试玩关卡数（第一章 · 边境试炼）。 */
export const TRIAL_LEVELS = 5

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
 * TODO: 在此接入真实支付渠道（Stripe / 微信支付 / 支付宝等）。
 * 支付成功回调中调用 unlockFullVersion() 并 resolve(true)。
 * 当前为模拟支付：600ms 后自动成功，方便走通流程。
 */
export async function requestPurchase(): Promise<boolean> {
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
