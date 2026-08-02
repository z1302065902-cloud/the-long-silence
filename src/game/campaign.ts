import type { WeaponId } from './combat'

export type ObjectiveKind = 'kills' | 'boss' | 'pickups' | 'score'

export type ObjectiveDef = {
  id: string
  kind: ObjectiveKind
  target: number
  label: string
  /** If true, level cannot clear until met */
  required: boolean
}

export type LevelDef = {
  id: number
  name: string
  chapter: number
  chapterName: string
  brief: string
  /** Waves of fodder before boss */
  waves: number
  enemiesPerWave: number
  enemyHpMul: number
  enemyDmgMul: number
  enemySpeedMul: number
  boss: BossDef
  clearReward: WeaponUpgradeId
  objectives: ObjectiveDef[]
}

export type BossDef = {
  name: string
  craft: string
  hp: number
  speed: number
  scale: number
  color: number
  weapon: WeaponId
  fireRateMul: number
  score: number
}

export type WeaponUpgradeId =
  | 'dmg_pulse'
  | 'dmg_plasma'
  | 'dmg_missile'
  | 'dmg_rail'
  | 'dmg_flak'
  | 'rof_all'
  | 'shield_boost'
  | 'hull_boost'
  | 'missile_lock'
  | 'crit_core'

export type WeaponUpgradeDef = {
  id: WeaponUpgradeId
  title: string
  blurb: string
}

export const WEAPON_UPGRADES: WeaponUpgradeDef[] = [
  { id: 'dmg_pulse', title: '脉冲增幅', blurb: '脉冲激光伤害 +18%' },
  { id: 'dmg_plasma', title: '等离子核心', blurb: '等离子伤害 +20%' },
  { id: 'dmg_missile', title: '弹头装填', blurb: '导弹伤害 +22%' },
  { id: 'dmg_rail', title: '轨道过载', blurb: '轨道炮伤害 +20%' },
  { id: 'dmg_flak', title: '霰射扩容', blurb: '高射炮伤害 +25%' },
  { id: 'rof_all', title: '冷却回路', blurb: '全武器射速 +10%' },
  { id: 'shield_boost', title: '护盾电容', blurb: '最大护盾 +20' },
  { id: 'hull_boost', title: '装甲加固', blurb: '最大船体 +25' },
  { id: 'missile_lock', title: '锁定算法', blurb: '导弹追踪 +35%' },
  { id: 'crit_core', title: '临界核心', blurb: '全武器伤害 +8%' },
]

export type ChapterDef = {
  id: number
  name: string
  blurb: string
  levelFrom: number
  levelTo: number
}

/** Four story chapters wrapping the 20-level campaign. */
export const CHAPTERS: ChapterDef[] = [
  {
    id: 1,
    name: '第一章 · 边境试炼',
    blurb: '肃清外围巡逻队，夺回航道控制权。',
    levelFrom: 1,
    levelTo: 5,
  },
  {
    id: 2,
    name: '第二章 · 矿带猎杀',
    blurb: '突入小行星带，截击走私武装。',
    levelFrom: 6,
    levelTo: 10,
  },
  {
    id: 3,
    name: '第三章 · 静默航道',
    blurb: '穿过通讯死区，猎杀幽灵舰队。',
    levelFrom: 11,
    levelTo: 15,
  },
  {
    id: 4,
    name: '第四章 · 终焉回响',
    blurb: '突入核心星域，终结漫长寂静。',
    levelFrom: 16,
    levelTo: 20,
  },
]

const BOSS_CRAFTS = [
  'Imperial.glb',
  'Executioner.glb',
  'Zenith.glb',
  'Omen.glb',
  'Insurgent.glb',
  'Challenger.glb',
  'Striker.glb',
  'Dispatcher.glb',
  'Pancake.glb',
  'Spitfire.glb',
  'Bob.glb',
]

const BOSS_NAMES = [
  'Scrap Warden',
  'Ash Corsair',
  'Crya Leviathan',
  'Helios Judge',
  'Void Reaper',
  'Ore Tyrant',
  'Needle Sovereign',
  'Plasma Hydra',
  'Silent Admiral',
  'Rust Colossus',
  'Solar Seraph',
  'Night Bastion',
  'Pulse Phantom',
  'Iron Chorus',
  'Eclipse Drake',
  'Station Ghost',
  'Amber Sovereign',
  'Deep Choir',
  'Final Arbiter',
  'Long Silence',
]

const LEVEL_BRIEFS = [
  '击破先锋拦截编队，熟悉脉冲火力。',
  '清理扫荡舰，练习侧移规避。',
  '拾取射击升级，强化当前武器。',
  '面对首个重装护卫，保持开火距离。',
  '章末：击败 Scrap Warden，打开矿带航道。',
  '矿带入口遭遇战——优先高威胁目标。',
  '狭窄航道伏击，注意导弹来袭。',
  '收集战场强化模块，维持火力优势。',
  '重火力炮艇出现，拉开交战圈。',
  '章末：击破 Ore Tyrant，夺取补给线。',
  '进入静默区：传感器噪声上升。',
  '幽灵编队袭来，保持锁定切换。',
  '拾取临界核心碎片，提升全武器伤害。',
  '双线夹击演练——别被包夹。',
  '章末：猎杀 Night Bastion。',
  '核心星域外围，敌军射速提升。',
  '突破防御圈，优先削弱护盾单位。',
  '最后的强化窗口：尽量拾取升级。',
  '决战前夜：清空卫队。',
  '终章：终结 Long Silence。',
]

const WEAPONS_CYCLE: WeaponId[] = ['pulse', 'flak', 'plasma', 'missile', 'rail']

function rewardForLevel(level: number): WeaponUpgradeId {
  const ids = WEAPON_UPGRADES.map((u) => u.id)
  return ids[(level - 1) % ids.length]
}

function chapterForLevel(level: number): ChapterDef {
  return CHAPTERS.find((c) => level >= c.levelFrom && level <= c.levelTo) ?? CHAPTERS[0]
}

function objectivesForLevel(id: number, bossName: string, killTarget: number): ObjectiveDef[] {
  const objs: ObjectiveDef[] = [
    {
      id: `kills-${id}`,
      kind: 'kills',
      target: killTarget,
      label: `歼灭 ${killTarget} 架敌机`,
      required: true,
    },
    {
      id: `boss-${id}`,
      kind: 'boss',
      target: 1,
      label: `击败 Boss · ${bossName}`,
      required: true,
    },
  ]
  // Every 3rd level requires a power pickup — teaches the scoop loop
  if (id % 3 === 0) {
    objs.push({
      id: `pickup-${id}`,
      kind: 'pickups',
      target: 1,
      label: '拾取 1 个射击升级',
      required: true,
    })
  } else if (id % 5 === 0) {
    objs.push({
      id: `score-${id}`,
      kind: 'score',
      target: 600 + id * 80,
      label: `本关得分 ${600 + id * 80}+`,
      required: false,
    })
  }
  return objs
}

/** 20 campaign levels in 4 chapters — each with explicit objectives. */
export const LEVELS: LevelDef[] = Array.from({ length: 20 }, (_, i) => {
  const id = i + 1
  const t = i / 19
  const ch = chapterForLevel(id)
  const waves = 2 + Math.floor(i / 4)
  const enemiesPerWave = 2 + Math.floor(i / 3)
  const killTarget = Math.max(3, waves * enemiesPerWave)
  return {
    id,
    name: `${ch.name.split('·')[0].trim()} · 任务 ${id}`,
    chapter: ch.id,
    chapterName: ch.name,
    brief: LEVEL_BRIEFS[i] ?? ch.blurb,
    waves,
    enemiesPerWave,
    enemyHpMul: 1 + t * 1.8,
    enemyDmgMul: 1 + t * 1.4,
    enemySpeedMul: 1 + t * 0.55,
    boss: {
      name: BOSS_NAMES[i],
      craft: BOSS_CRAFTS[i % BOSS_CRAFTS.length],
      hp: Math.round(420 + i * 95 + i * i * 6),
      speed: 22 + i * 1.1,
      scale: 1.55 + t * 0.55,
      color: [0xff6644, 0xffaa33, 0x66ddff, 0xff55aa, 0xaaff66, 0xffdd55][i % 6],
      weapon: WEAPONS_CYCLE[i % WEAPONS_CYCLE.length],
      fireRateMul: 1.1 + t * 1.6,
      score: 800 + i * 220,
    },
    clearReward: rewardForLevel(id),
    objectives: objectivesForLevel(id, BOSS_NAMES[i], killTarget),
  }
})

const SAVE_KEY = 'tls-campaign-v1'

export type CampaignSave = {
  level: number
  highestCleared: number
  upgrades: WeaponUpgradeId[]
}

export function loadCampaign(): CampaignSave {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return { level: 1, highestCleared: 0, upgrades: [] }
    const p = JSON.parse(raw) as Partial<CampaignSave>
    return {
      level: Math.min(20, Math.max(1, Number(p.level) || 1)),
      highestCleared: Math.min(20, Math.max(0, Number(p.highestCleared) || 0)),
      upgrades: Array.isArray(p.upgrades) ? (p.upgrades as WeaponUpgradeId[]) : [],
    }
  } catch {
    return { level: 1, highestCleared: 0, upgrades: [] }
  }
}

export function saveCampaign(save: CampaignSave) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save))
}

export function getLevel(id: number): LevelDef {
  return LEVELS[Math.min(19, Math.max(0, id - 1))]
}

export function getChapter(id: number): ChapterDef {
  return CHAPTERS.find((c) => c.id === id) ?? CHAPTERS[0]
}

export function upgradeDef(id: WeaponUpgradeId): WeaponUpgradeDef {
  return WEAPON_UPGRADES.find((u) => u.id === id) ?? WEAPON_UPGRADES[0]
}
