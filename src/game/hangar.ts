import { gameAudio } from './audio'
import {
  isFullVersion,
  requestPurchase,
  validateActivationCode,
  TRIAL_LEVELS,
  AFDIAN_VERIFY_URL,
} from './paid'
import {
  SHIP_CATALOG,
  addHangarCredits,
  getHangarCredits,
  getSelectedShipId,
  getShipDef,
  isShipUnlocked,
  selectShip,
  unlockShip,
  type ShipDef,
} from './ships'

export type HangarUI = {
  root: HTMLElement
  refresh: () => void
  getSelected: () => ShipDef
  onSelect: (cb: (def: ShipDef) => void) => void
}

export function mountHangar(onChange?: (def: ShipDef) => void): HangarUI {
  const root = document.getElementById('hangar')!
  const creditsEl = document.getElementById('hangar-credits')!
  const grid = document.getElementById('hangar-grid')!
  const nameEl = document.getElementById('hangar-name')!
  const tagEl = document.getElementById('hangar-tag')!
  const statsEl = document.getElementById('hangar-stats')!
  const actionBtn = document.getElementById('hangar-action') as HTMLButtonElement
  const launchBtn = document.getElementById('launch-btn') as HTMLButtonElement
  const fullBannerText = document.getElementById('full-banner-text')
  const fullBtn = document.getElementById('btn-full') as HTMLButtonElement
  const redeemInput = document.getElementById('redeem-input') as HTMLInputElement
  const redeemBtn = document.getElementById('redeem-btn') as HTMLButtonElement
  const redeemMsg = document.getElementById('redeem-msg')

  let previewId = getSelectedShipId()
  let selectCb: ((def: ShipDef) => void) | null = onChange ?? null

  fullBtn?.addEventListener('click', (e) => {
    e.stopPropagation()
    gameAudio.play('ui')
    void requestPurchase().then((ok) => {
      if (!ok) return
      refresh()
      if (fullBannerText) fullBannerText.textContent = '完整版 · 已解锁全部 20 关与所有飞船'
    })
  })

  const doRedeem = async () => {
    if (!redeemInput || !redeemMsg) return
    const raw = redeemInput.value.trim()
    if (!raw) return
    gameAudio.play('ui')
    redeemMsg.textContent = '验证中…'
    redeemMsg.className = 'redeem-msg'
    // 爱发电订单号 = 纯数字（14 位以上）→ 走服务端自助解锁
    const looksLikeAfdianOrder = /^\d{14,}$/.test(raw.replace(/[\s-]/g, ''))
    let ok = false
    if (looksLikeAfdianOrder) {
      try {
        const order = encodeURIComponent(raw.replace(/[\s-]/g, ''))
        const r = await fetch(`${AFDIAN_VERIFY_URL}?order=${order}`, { method: 'GET' })
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; em?: string }
        ok = Boolean(j.ok)
        if (!ok) redeemMsg.textContent = j.em === 'order not paid' ? '订单未找到或未付款' : '验证失败，请稍后再试'
      } catch {
        redeemMsg.textContent = '网络错误，请稍后再试'
      }
    } else {
      ok = await validateActivationCode(raw)
    }
    if (ok) {
      redeemMsg.textContent = '✓ 解锁成功！'
      redeemMsg.className = 'redeem-msg ok'
      redeemInput.value = ''
      refresh()
      if (fullBannerText) fullBannerText.textContent = '完整版 · 已解锁全部 20 关与所有飞船'
    } else {
      redeemMsg.textContent = '激活码无效'
      redeemMsg.className = 'redeem-msg err'
    }
  }
  redeemBtn?.addEventListener('click', (e) => {
    e.stopPropagation()
    void doRedeem()
  })
  redeemInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void doRedeem()
  })

  grid.innerHTML = ''
  for (const ship of SHIP_CATALOG) {
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'hangar-card'
    card.dataset.id = ship.id
    card.innerHTML = `
      <span class="hangar-swatch" style="--swatch:${hex(ship.tint)}"></span>
      <span class="hangar-card-name">${ship.name}</span>
      <span class="hangar-card-meta"></span>
    `
    card.addEventListener('click', (e) => {
      e.stopPropagation()
      previewId = ship.id
      if (isShipUnlocked(ship.id)) selectShip(ship.id)
      refresh()
      selectCb?.(getShipDef(previewId))
    })
    grid.appendChild(card)
  }

  actionBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    const def = getShipDef(previewId)
    if (isShipUnlocked(def.id)) {
      selectShip(def.id)
      refresh()
      selectCb?.(def)
      return
    }
    const res = unlockShip(def.id)
    if (!res.ok) {
      actionBtn.classList.add('shake')
      window.setTimeout(() => actionBtn.classList.remove('shake'), 400)
      actionBtn.textContent = res.reason ?? '积分不足'
      window.setTimeout(() => refresh(), 1400)
      return
    }
    refresh()
    selectCb?.(def)
  })

  launchBtn.addEventListener('click', (e) => e.stopPropagation())

  function refresh() {
    const credits = getHangarCredits()
    creditsEl.textContent = `机库积分 ${credits}`
    const selected = getSelectedShipId()
    const preview = getShipDef(previewId)

    // Full-version banner — always set both states explicitly
    const full = isFullVersion()
    if (fullBtn) {
      fullBtn.textContent = full ? '完整版已解锁' : '解锁完整版'
      fullBtn.disabled = full
      fullBtn.classList.toggle('primary', !full)
    }
    if (fullBannerText) {
      fullBannerText.textContent = full
        ? '完整版 · 已解锁全部 20 关与所有飞船'
        : `试玩版 · 免费体验第 1–${TRIAL_LEVELS} 关`
    }

    for (const card of grid.querySelectorAll<HTMLButtonElement>('.hangar-card')) {
      const id = card.dataset.id!
      const def = getShipDef(id)
      const unlocked = isShipUnlocked(id)
      card.classList.toggle('selected', id === selected)
      card.classList.toggle('preview', id === previewId)
      card.classList.toggle('locked', !unlocked)
      const meta = card.querySelector('.hangar-card-meta')!
      meta.textContent = unlocked ? (def.free ? '免费' : '已解锁') : `${def.cost} 积分`
    }

    nameEl.textContent = preview.name
    tagEl.textContent = preview.tagline
    statsEl.textContent = `HP ${preview.hp} · SH ${preview.shield} · SPD ×${preview.speedMul.toFixed(2)}`

    if (isShipUnlocked(preview.id)) {
      const isEquipped = selected === preview.id
      actionBtn.textContent = isEquipped ? '已装备' : '装备此舰'
      actionBtn.disabled = isEquipped
      actionBtn.classList.toggle('primary', !isEquipped)
    } else {
      actionBtn.textContent = `解锁 · ${preview.cost} 积分`
      actionBtn.disabled = credits < preview.cost
      actionBtn.classList.add('primary')
    }
  }

  refresh()

  return {
    root,
    refresh,
    getSelected: () => getShipDef(getSelectedShipId()),
    onSelect: (cb) => {
      selectCb = cb
    },
  }
}

export function grantKillCredits(scoreReward: number) {
  // Score is also hangar currency (partial convert)
  return addHangarCredits(Math.max(1, Math.floor(scoreReward * 0.35)))
}

function hex(n: number) {
  return `#${n.toString(16).padStart(6, '0')}`
}
