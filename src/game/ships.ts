import { isFullVersion } from './paid'

/** Player hangar — Quaternius Ultimate Spaceships (CC0) + Kenney fallbacks. */

export type ShipDef = {
  id: string
  name: string
  tagline: string
  /** Filename under pack folder */
  craft: string
  pack: 'quaternius' | 'kenney' | 'highpoly'
  free: boolean
  cost: number
  tint: number
  emissive: number
  emissiveIntensity: number
  scale: number
  hp: number
  shield: number
  speedMul: number
  /** Keep Quaternius albedo when true */
  keepTexture?: boolean
}

export const SHIP_CATALOG: ShipDef[] = [
  {
    id: 'bob',
    name: 'Bob',
    tagline: 'Quaternius · 均衡巡航（免费）',
    craft: 'Bob.glb',
    pack: 'quaternius',
    free: true,
    cost: 0,
    tint: 0x7ec8c4,
    emissive: 0x1a4a55,
    emissiveIntensity: 0.35,
    scale: 1,
    hp: 160,
    shield: 90,
    speedMul: 1,
    keepTexture: true,
  },
  {
    id: 'challenger',
    name: 'Challenger',
    tagline: 'Quaternius · 深空突击（免费）',
    craft: 'Challenger.glb',
    pack: 'quaternius',
    free: true,
    cost: 0,
    tint: 0x3d9ea8,
    emissive: 0x0a3038,
    emissiveIntensity: 0.4,
    scale: 1.05,
    hp: 170,
    shield: 100,
    speedMul: 1.08,
    keepTexture: true,
  },
  {
    id: 'spitfire',
    name: 'Spitfire',
    tagline: 'Quaternius · 赤焰尖刀（免费）',
    craft: 'Spitfire.glb',
    pack: 'quaternius',
    free: true,
    cost: 0,
    tint: 0xff6b6b,
    emissive: 0x4a1018,
    emissiveIntensity: 0.5,
    scale: 1,
    hp: 145,
    shield: 85,
    speedMul: 1.14,
    keepTexture: true,
  },
  {
    id: 'striker-q',
    name: 'Striker',
    tagline: 'Quaternius · 侧翼猎手',
    craft: 'Striker.glb',
    pack: 'quaternius',
    free: false,
    cost: 700,
    tint: 0xc4a574,
    emissive: 0x3a2a10,
    emissiveIntensity: 0.38,
    scale: 1.02,
    hp: 180,
    shield: 110,
    speedMul: 1.1,
    keepTexture: true,
  },
  {
    id: 'dispatcher',
    name: 'Dispatcher',
    tagline: 'Quaternius · 快速投送',
    craft: 'Dispatcher.glb',
    pack: 'quaternius',
    free: false,
    cost: 1000,
    tint: 0xa8d4ff,
    emissive: 0x204060,
    emissiveIntensity: 0.42,
    scale: 1.04,
    hp: 165,
    shield: 115,
    speedMul: 1.16,
    keepTexture: true,
  },
  {
    id: 'executioner',
    name: 'Executioner',
    tagline: 'Quaternius · 重火力',
    craft: 'Executioner.glb',
    pack: 'quaternius',
    free: false,
    cost: 1400,
    tint: 0x9aa8b8,
    emissive: 0x243040,
    emissiveIntensity: 0.35,
    scale: 1.12,
    hp: 210,
    shield: 130,
    speedMul: 0.9,
    keepTexture: true,
  },
  {
    id: 'insurgent',
    name: 'Insurgent',
    tagline: 'Quaternius · 叛军改型',
    craft: 'Insurgent.glb',
    pack: 'quaternius',
    free: false,
    cost: 1800,
    tint: 0xe8a54b,
    emissive: 0x5a3010,
    emissiveIntensity: 0.48,
    scale: 1.06,
    hp: 190,
    shield: 120,
    speedMul: 1.12,
    keepTexture: true,
  },
  {
    id: 'imperial',
    name: 'Imperial',
    tagline: 'Quaternius · 旗舰轮廓',
    craft: 'Imperial.glb',
    pack: 'quaternius',
    free: false,
    cost: 2200,
    tint: 0xf0c96a,
    emissive: 0x5a4010,
    emissiveIntensity: 0.48,
    scale: 1.15,
    hp: 230,
    shield: 145,
    speedMul: 0.88,
    keepTexture: true,
  },
  {
    id: 'omen',
    name: 'Omen',
    tagline: 'Quaternius · 幽灵猎杀',
    craft: 'Omen.glb',
    pack: 'quaternius',
    free: false,
    cost: 2800,
    tint: 0x5ee0c8,
    emissive: 0x0a4038,
    emissiveIntensity: 0.55,
    scale: 1.04,
    hp: 175,
    shield: 125,
    speedMul: 1.18,
    keepTexture: true,
  },
  {
    id: 'zenith',
    name: 'Zenith',
    tagline: 'Quaternius · 日冕终型',
    craft: 'Zenith.glb',
    pack: 'quaternius',
    free: false,
    cost: 3600,
    tint: 0xe8d48a,
    emissive: 0x604010,
    emissiveIntensity: 0.6,
    scale: 1.2,
    hp: 200,
    shield: 150,
    speedMul: 1.12,
    keepTexture: true,
  },
  {
    id: 'harbinger',
    name: 'Harbinger',
    tagline: 'High-Poly · 指挥级战舰（CC BY · Comrade1280）',
    craft: 'harbinger.glb',
    pack: 'highpoly',
    free: false,
    cost: 5000,
    tint: 0x8aa0c0,
    emissive: 0x20304a,
    emissiveIntensity: 0.35,
    scale: 0.9,
    hp: 260,
    shield: 180,
    speedMul: 0.85,
    keepTexture: true,
  },
  {
    id: 'dvergr',
    name: 'Dvergr',
    tagline: 'High-Poly · 轻型战斗机（CC BY）',
    craft: 'dvergr.glb',
    pack: 'highpoly',
    free: false,
    cost: 3000,
    tint: 0x9ab0cc,
    emissive: 0x1a2a44,
    emissiveIntensity: 0.3,
    scale: 1.0,
    hp: 190,
    shield: 130,
    speedMul: 1.05,
    keepTexture: true,
  },
  {
    id: 'fighter',
    name: 'Space Fighter',
    tagline: 'High-Poly · 中型战斗机（CC BY · Comrade1280）',
    craft: 'fighter.glb',
    pack: 'highpoly',
    free: false,
    cost: 4000,
    tint: 0xc0a0b0,
    emissive: 0x30202a,
    emissiveIntensity: 0.32,
    scale: 1.0,
    hp: 210,
    shield: 140,
    speedMul: 0.95,
    keepTexture: true,
  },
  {
    id: 'hammerhead',
    name: 'Hammerhead',
    tagline: 'High-Poly · 重装突击舰（CC BY）',
    craft: 'hammerhead.glb',
    pack: 'highpoly',
    free: false,
    cost: 4500,
    tint: 0x9aa8c0,
    emissive: 0x1a2a3a,
    emissiveIntensity: 0.3,
    scale: 1.0,
    hp: 240,
    shield: 160,
    speedMul: 0.9,
    keepTexture: true,
  },
  {
    id: 'pod',
    name: 'Space Pod',
    tagline: 'High-Poly · 个人太空舱（CC BY · futaba@blender）',
    craft: 'pod.glb',
    pack: 'highpoly',
    free: false,
    cost: 2200,
    tint: 0xb0a8c0,
    emissive: 0x28204a,
    emissiveIntensity: 0.3,
    scale: 1.1,
    hp: 150,
    shield: 100,
    speedMul: 1.2,
    keepTexture: true,
  },
]

const STORAGE_KEY = 'tls-hangar-v1'

type HangarSave = {
  selectedId: string
  unlocked: string[]
  credits: number
}

function defaultSave(): HangarSave {
  return {
    selectedId: SHIP_CATALOG[0].id,
    unlocked: SHIP_CATALOG.filter((s) => s.free).map((s) => s.id),
    credits: 0,
  }
}

function readSave(): HangarSave {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSave()
    const parsed = JSON.parse(raw) as Partial<HangarSave>
    const base = defaultSave()
    const unlocked = new Set([
      ...base.unlocked,
      ...(Array.isArray(parsed.unlocked) ? parsed.unlocked : []),
    ])
    // Migrate old kenney ids → first free ship
    let selectedId = typeof parsed.selectedId === 'string' ? parsed.selectedId : base.selectedId
    if (!SHIP_CATALOG.some((s) => s.id === selectedId)) selectedId = base.selectedId
    return {
      selectedId,
      unlocked: [...unlocked].filter((id) => SHIP_CATALOG.some((s) => s.id === id)),
      credits: Math.max(0, Math.floor(Number(parsed.credits) || 0)),
    }
  } catch {
    return defaultSave()
  }
}

function writeSave(save: HangarSave) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
}

export function getShipDef(id: string): ShipDef {
  return SHIP_CATALOG.find((s) => s.id === id) ?? SHIP_CATALOG[0]
}

export function getSelectedShipId(): string {
  return readSave().selectedId
}

export function getHangarCredits(): number {
  return readSave().credits
}

export function isShipUnlocked(id: string): boolean {
  const save = readSave()
  const def = getShipDef(id)
  // 完整版解锁后全部飞船直接可用
  if (isFullVersion()) return true
  return def.free || save.unlocked.includes(id)
}

export function selectShip(id: string): boolean {
  if (!isShipUnlocked(id)) return false
  const save = readSave()
  save.selectedId = id
  writeSave(save)
  return true
}

export function unlockShip(id: string): { ok: boolean; reason?: string } {
  const def = getShipDef(id)
  if (def.free) {
    selectShip(id)
    return { ok: true }
  }
  const save = readSave()
  if (save.unlocked.includes(id)) {
    save.selectedId = id
    writeSave(save)
    return { ok: true }
  }
  if (save.credits < def.cost) {
    return { ok: false, reason: `需要 ${def.cost} 积分（当前 ${save.credits}）` }
  }
  save.credits -= def.cost
  save.unlocked.push(id)
  save.selectedId = id
  writeSave(save)
  return { ok: true }
}

export function addHangarCredits(amount: number) {
  if (amount <= 0) return getHangarCredits()
  const save = readSave()
  save.credits += Math.floor(amount)
  writeSave(save)
  return save.credits
}
