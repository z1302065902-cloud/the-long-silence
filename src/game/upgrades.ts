import type { WeaponDef, WeaponId } from './combat'
import type { WeaponUpgradeId } from './campaign'

export type UpgradeState = {
  dmgMul: Record<WeaponId, number>
  rofMul: number
  shieldBonus: number
  hullBonus: number
  missileHomingMul: number
  globalDmgMul: number
}

export function createUpgradeState(): UpgradeState {
  return {
    dmgMul: { pulse: 1, plasma: 1, missile: 1, rail: 1, flak: 1, mine: 1 },
    rofMul: 1,
    shieldBonus: 0,
    hullBonus: 0,
    missileHomingMul: 1,
    globalDmgMul: 1,
  }
}

export function applyUpgrade(state: UpgradeState, id: WeaponUpgradeId): UpgradeState {
  const s = {
    ...state,
    dmgMul: { ...state.dmgMul },
  }
  switch (id) {
    case 'dmg_pulse':
      s.dmgMul.pulse *= 1.18
      break
    case 'dmg_plasma':
      s.dmgMul.plasma *= 1.2
      break
    case 'dmg_missile':
      s.dmgMul.missile *= 1.22
      break
    case 'dmg_rail':
      s.dmgMul.rail *= 1.2
      break
    case 'dmg_flak':
      s.dmgMul.flak *= 1.25
      break
    case 'dmg_mine':
      s.dmgMul.mine *= 1.25
      break
    case 'rof_all':
      s.rofMul *= 1.1
      break
    case 'shield_boost':
      s.shieldBonus += 20
      break
    case 'hull_boost':
      s.hullBonus += 25
      break
    case 'missile_lock':
      s.missileHomingMul *= 1.35
      break
    case 'crit_core':
      s.globalDmgMul *= 1.08
      break
  }
  return s
}

export function foldUpgrades(ids: WeaponUpgradeId[]): UpgradeState {
  return ids.reduce((acc, id) => applyUpgrade(acc, id), createUpgradeState())
}

export function scaleWeapon(base: WeaponDef, state: UpgradeState): WeaponDef {
  const dmg = base.damage * (state.dmgMul[base.id] ?? 1) * state.globalDmgMul
  const cooldown = base.cooldown / state.rofMul
  const homing =
    base.homing != null ? base.homing * (base.id === 'missile' ? state.missileHomingMul : 1) : base.homing
  return { ...base, damage: dmg, cooldown, homing }
}
