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

  let previewId = getSelectedShipId()
  let selectCb: ((def: ShipDef) => void) | null = onChange ?? null

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
