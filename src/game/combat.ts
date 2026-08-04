import * as THREE from 'three'
import { loadCraftFile } from './assets'
import {
  getLevel,
  loadCampaign,
  saveCampaign,
  type LevelDef,
  type ObjectiveDef,
  type WeaponUpgradeId,
} from './campaign'
import { FxSystem } from './fx'
import { foldUpgrades, scaleWeapon, type UpgradeState } from './upgrades'

export type WeaponId = 'pulse' | 'plasma' | 'missile' | 'rail' | 'flak'

export type WeaponDef = {
  id: WeaponId
  name: string
  cooldown: number
  damage: number
  speed: number
  life: number
  color: number
  radius: number
  spread?: number
  count?: number
  homing?: number
  pierce?: boolean
  charge?: number
}

export const WEAPONS: WeaponDef[] = [
  {
    id: 'pulse',
    name: 'PULSE LASER',
    cooldown: 0.08,
    damage: 14,
    speed: 260,
    life: 1.4,
    color: 0x66ffee,
    radius: 0.35,
  },
  {
    id: 'plasma',
    name: 'PLASMA BOLT',
    cooldown: 0.38,
    damage: 28,
    speed: 95,
    life: 2.2,
    color: 0xb44cff,
    radius: 1.1,
  },
  {
    id: 'missile',
    name: 'SEEKER MISS',
    cooldown: 0.7,
    damage: 45,
    speed: 70,
    life: 4.5,
    color: 0xff8844,
    radius: 0.55,
    homing: 3.2,
  },
  {
    id: 'rail',
    name: 'RAIL LANCE',
    cooldown: 1.1,
    damage: 90,
    speed: 420,
    life: 1.1,
    color: 0xaaccff,
    radius: 0.25,
    pierce: true,
    charge: 0.35,
  },
  {
    id: 'flak',
    name: 'FLAK BURST',
    cooldown: 0.45,
    damage: 10,
    speed: 140,
    life: 0.9,
    color: 0xffdd55,
    radius: 0.4,
    spread: 0.22,
    count: 7,
  },
]

type Projectile = {
  active: boolean
  mesh: THREE.Mesh
  bodyGroup: THREE.Group
  missileGroup: THREE.Group
  glow: THREE.Sprite
  trail: THREE.Points | null
  trailPos: Float32Array
  trailIdx: number
  velocity: THREE.Vector3
  life: number
  damage: number
  radius: number
  fromPlayer: boolean
  homing: number
  pierce: boolean
  hit: Set<number>
  weaponId: WeaponId
  glowPhase: number
}

export type EnemyKind =
  | 'interceptor'
  | 'striker'
  | 'heavy'
  | 'sniper'
  | 'gunship'
  | 'swarm'
  | 'raider'
  | 'scout'
  | 'assault'
  | 'carrier'
  | 'phantom'
  | 'warden'

type EnemyDef = {
  kind: EnemyKind
  label: string
  craft: string
  pack: 'quaternius' | 'kenney'
  hp: number
  speed: number
  scale: number
  color: number
  weapon: WeaponId
  score: number
  ai: 'dogfight' | 'strafe' | 'sniper' | 'tank' | 'swarm'
}

/** Quaternius hulls — more varieties, keep textures readable. */
const ENEMY_DEFS: EnemyDef[] = [
  {
    kind: 'interceptor',
    label: 'Crimson Bob',
    craft: 'Bob.glb',
    pack: 'quaternius',
    hp: 42,
    speed: 52,
    scale: 0.82,
    color: 0xff5566,
    weapon: 'pulse',
    score: 100,
    ai: 'dogfight',
  },
  {
    kind: 'striker',
    label: 'Ash Spitfire',
    craft: 'Spitfire.glb',
    pack: 'quaternius',
    hp: 55,
    speed: 48,
    scale: 0.9,
    color: 0xffaa33,
    weapon: 'flak',
    score: 140,
    ai: 'strafe',
  },
  {
    kind: 'heavy',
    label: 'Iron Imperial',
    craft: 'Imperial.glb',
    pack: 'quaternius',
    hp: 150,
    speed: 26,
    scale: 1.2,
    color: 0x8899aa,
    weapon: 'plasma',
    score: 260,
    ai: 'tank',
  },
  {
    kind: 'sniper',
    label: 'Frost Challenger',
    craft: 'Challenger.glb',
    pack: 'quaternius',
    hp: 48,
    speed: 40,
    scale: 0.88,
    color: 0x66aaff,
    weapon: 'rail',
    score: 200,
    ai: 'sniper',
  },
  {
    kind: 'gunship',
    label: 'Ore Executioner',
    craft: 'Executioner.glb',
    pack: 'quaternius',
    hp: 125,
    speed: 32,
    scale: 1.05,
    color: 0xcc8844,
    weapon: 'missile',
    score: 230,
    ai: 'strafe',
  },
  {
    kind: 'swarm',
    label: 'Swarm Pancake',
    craft: 'Pancake.glb',
    pack: 'quaternius',
    hp: 24,
    speed: 60,
    scale: 0.62,
    color: 0xff6688,
    weapon: 'pulse',
    score: 70,
    ai: 'swarm',
  },
  {
    kind: 'raider',
    label: 'Void Striker',
    craft: 'Striker.glb',
    pack: 'quaternius',
    hp: 60,
    speed: 50,
    scale: 0.92,
    color: 0xff7744,
    weapon: 'plasma',
    score: 160,
    ai: 'dogfight',
  },
  {
    kind: 'scout',
    label: 'Courier Dispatch',
    craft: 'Dispatcher.glb',
    pack: 'quaternius',
    hp: 38,
    speed: 58,
    scale: 0.8,
    color: 0x88ddff,
    weapon: 'pulse',
    score: 120,
    ai: 'strafe',
  },
  {
    kind: 'assault',
    label: 'Rebel Insurgent',
    craft: 'Insurgent.glb',
    pack: 'quaternius',
    hp: 90,
    speed: 42,
    scale: 0.98,
    color: 0xe8a54b,
    weapon: 'flak',
    score: 190,
    ai: 'dogfight',
  },
  {
    kind: 'carrier',
    label: 'Bulk Pancake',
    craft: 'Pancake.glb',
    pack: 'quaternius',
    hp: 160,
    speed: 24,
    scale: 1.25,
    color: 0xaab8c8,
    weapon: 'missile',
    score: 280,
    ai: 'tank',
  },
  {
    kind: 'phantom',
    label: 'Ghost Omen',
    craft: 'Omen.glb',
    pack: 'quaternius',
    hp: 70,
    speed: 54,
    scale: 0.9,
    color: 0x5ee0c8,
    weapon: 'rail',
    score: 210,
    ai: 'sniper',
  },
  {
    kind: 'warden',
    label: 'Zenith Guard',
    craft: 'Zenith.glb',
    pack: 'quaternius',
    hp: 110,
    speed: 36,
    scale: 1.08,
    color: 0xf0c96a,
    weapon: 'plasma',
    score: 240,
    ai: 'strafe',
  },
]

export type CombatEnemy = {
  id: number
  def: EnemyDef
  group: THREE.Group
  hp: number
  maxHp: number
  alive: boolean
  cooldown: number
  velocity: THREE.Vector3
  wander: number
  isBoss?: boolean
  dmgMul?: number
  fireRateMul?: number
}

type Phase = 'wave' | 'boss' | 'clear' | 'done'

type PickupKind = 'rof' | 'dmg' | 'crit'

type PowerPickup = {
  active: boolean
  kind: PickupKind
  mesh: THREE.Group
  light: THREE.PointLight
  life: number
  spin: number
}

const PICKUP_EVERY = 3
const PICKUP_RADIUS = 20
const PICKUP_LIFE = 40
const PICKUP_MAGNET = 220

export class CombatSystem {
  readonly root = new THREE.Group()
  readonly fx = new FxSystem()
  playerHp = 160
  playerMaxHp = 160
  shield = 90
  shieldMax = 90
  kills = 0
  score = 0
  weaponIndex = 0
  targetId: number | null = null
  /** Runtime powerups collected this sortie (survives level transitions). */
  powerLevel = 0
  onKillReward: ((score: number) => void) | null = null
  onLevelClear: ((level: number, reward: WeaponUpgradeId) => void) | null = null
  onPickup: ((label: string) => void) | null = null
  onSfx: ((kind: 'fire' | 'fire_pulse' | 'fire_plasma' | 'fire_missile' | 'fire_rail' | 'fire_flak' | 'hit' | 'boom' | 'pickup' | 'damage' | 'clear') => void) | null = null
  private weaponCd = 0
  private charge = 0
  private projectiles: Projectile[] = []
  private enemies: CombatEnemy[] = []
  private pickups: PowerPickup[] = []
  private killsSincePickup = 0
  private sortieKills = 0
  private pickupIds: WeaponUpgradeId[] = []
  private nextId = 1
  private spawnTimer = 1.2
  private wave = 1
  private level: LevelDef = getLevel(1)
  private phase: Phase = 'wave'
  private waveIndex = 0
  private upgradeState: UpgradeState = foldUpgrades([])
  private clearTimer = 0
  private baseHull = 160
  private baseShield = 90
  private levelKills = 0
  private levelScoreStart = 0
  private levelPickups = 0
  private bossDown = false
  private tmp = new THREE.Vector3()
  private tmp2 = new THREE.Vector3()
  private tmp3 = new THREE.Vector3()
  private fwd = new THREE.Vector3()
  private right = new THREE.Vector3()
  private craftCache = new Map<string, THREE.Group>()
  private ready = false
  private hitFlash = 0
  private playerRef: THREE.Object3D | null = null

  constructor() {
    this.root.add(this.fx.root)
  }

  get weapon() {
    return scaleWeapon(WEAPONS[this.weaponIndex], this.upgradeState)
  }

  get levelId() {
    return this.level.id
  }

  get phaseName() {
    return this.phase
  }

  get enemyList() {
    return this.enemies
  }

  /** Nearest active power pickup, if any. */
  getNearestPickup(from: THREE.Vector3): { position: THREE.Vector3; kind: PickupKind } | null {
    let best: PowerPickup | null = null
    let bestD = Infinity
    for (const p of this.pickups) {
      if (!p.active) continue
      const d = p.mesh.position.distanceToSquared(from)
      if (d < bestD) {
        bestD = d
        best = p
      }
    }
    return best ? { position: best.mesh.position, kind: best.kind } : null
  }

  async init() {
    // Lightweight init — combat is playable immediately with fallback hulls.
    // Enemy/boss models warm up in the background; spawn uses makeFallbackHull
    // until each model arrives, so slow asset links never block the game.
    const save = loadCampaign()
    this.upgradeState = foldUpgrades(save.upgrades)
    this.startLevel(save.level)
    this.ready = true
    this.warmModels().catch(() => {})
  }

  private async warmModels() {
    const keys = new Set(ENEMY_DEFS.map((d) => `${d.pack}:${d.craft}`))
    for (let i = 1; i <= 20; i++) keys.add(`quaternius:${getLevel(i).boss.craft}`)
    await Promise.all(
      [...keys].map(async (key) => {
        if (this.craftCache.has(key)) return
        const [pack, craft] = key.split(':') as ['quaternius' | 'kenney', string]
        try {
          const g = await loadCraftFile(pack, craft, {
            keepTexture: true,
            scale: 1,
            noThrusters: true,
          })
          this.craftCache.set(key, g)
        } catch {
          this.craftCache.set(key, this.makeFallbackHull(0xff5566))
        }
      }),
    )
  }

  startLevel(levelId: number) {
    this.level = getLevel(levelId)
    this.phase = 'wave'
    this.waveIndex = 0
    this.wave = 1
    this.spawnTimer = 1.2
    this.clearTimer = 0
    this.killsSincePickup = 0
    this.levelKills = 0
    this.levelPickups = 0
    this.bossDown = false
    this.levelScoreStart = this.score
    // Keep powerLevel / sortie pickups across level clears within one sortie
    this.rebuildUpgrades()
    this.clearPickups()
    this.clearEnemies()
    for (const p of this.projectiles) {
      p.active = false
      p.mesh.visible = false
      p.missileGroup.visible = false
      p.bodyGroup.visible = false
    }
  }

  /** Call when starting a fresh play / autotest session. */
  resetSortiePower() {
    this.powerLevel = 0
    this.sortieKills = 0
    this.killsSincePickup = 0
    this.pickupIds = []
    this.clearPickups()
    this.rebuildUpgrades()
  }

  private rebuildUpgrades() {
    this.upgradeState = foldUpgrades([...loadCampaign().upgrades, ...this.pickupIds])
    this.playerMaxHp = this.baseHull + this.upgradeState.hullBonus
    this.shieldMax = this.baseShield + this.upgradeState.shieldBonus
  }

  private clearPickups() {
    for (const p of this.pickups) {
      p.active = false
      this.root.remove(p.mesh)
    }
    this.pickups = []
  }

  private clearEnemies() {
    for (const e of this.enemies) {
      e.alive = false
      this.root.remove(e.group)
    }
    this.enemies = []
  }

  private makeFallbackHull(color: number) {
    const g = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(1.2, 4.5, 6),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.35,
        metalness: 0.4,
        roughness: 0.45,
      }),
    )
    body.rotation.x = Math.PI / 2
    g.add(body)
    return g
  }

  cycleWeapon(dir = 1) {
    this.weaponIndex = (this.weaponIndex + dir + WEAPONS.length) % WEAPONS.length
    this.charge = 0
  }

  selectWeapon(index: number) {
    if (index < 0 || index >= WEAPONS.length) return
    this.weaponIndex = index
    this.charge = 0
  }

  cycleTarget(from: THREE.Vector3) {
    const alive = this.enemies.filter((e) => e.alive)
    if (!alive.length) {
      this.targetId = null
      return
    }
    alive.sort((a, b) => a.group.position.distanceToSquared(from) - b.group.position.distanceToSquared(from))
    if (this.targetId == null) {
      this.targetId = alive[0].id
      return
    }
    const i = alive.findIndex((e) => e.id === this.targetId)
    this.targetId = alive[(i + 1) % alive.length].id
  }

  getTarget(): CombatEnemy | null {
    if (this.targetId == null) return null
    return this.enemies.find((e) => e.id === this.targetId && e.alive) ?? null
  }

  update(
    dt: number,
    player: THREE.Object3D,
    playerVel: THREE.Vector3,
    opts: {
      fire: boolean
      altFire: boolean
      flying: boolean
    },
  ) {
    this.playerRef = player
    if (!opts.flying || !this.ready) {
      this.updateProjectiles(dt, player, null)
      this.fx.update(dt)
      return
    }

    this.tickCampaign(dt, player.position)

    if (this.invuln > 0) this.invuln -= dt
    if (this.shield < this.shieldMax) {
      this.shield = Math.min(this.shieldMax, this.shield + dt * 6)
    }
    if (this.hitFlash > 0) this.hitFlash -= dt

    this.weaponCd = Math.max(0, this.weaponCd - dt)
    const w = this.weapon
    if (opts.fire) {
      if (w.charge) {
        this.charge = Math.min(1, this.charge + dt / w.charge)
        if (this.charge >= 1 && this.weaponCd <= 0) {
          this.firePlayer(player, w)
          this.charge = 0
          this.weaponCd = w.cooldown
        }
      } else if (this.weaponCd <= 0) {
        this.firePlayer(player, w)
        this.weaponCd = w.cooldown
      }
    } else if (w.charge && this.charge > 0.4 && this.weaponCd <= 0) {
      this.firePlayer(player, w, 0.5 + this.charge * 0.5)
      this.charge = 0
      this.weaponCd = w.cooldown
    } else if (!opts.fire) {
      this.charge = Math.max(0, this.charge - dt * 1.5)
    }

    if (opts.altFire && this.weaponCd <= 0) {
      const missile = scaleWeapon(WEAPONS.find((x) => x.id === 'missile')!, this.upgradeState)
      this.firePlayer(player, missile)
      this.weaponCd = missile.cooldown * 0.85
    }

    this.updateEnemies(dt, player, playerVel)
    this.updateProjectiles(dt, player, playerVel)
    this.updatePickups(dt, player.position)
    this.fx.update(dt)

    // auto-acquire nearest if none
    if (this.targetId == null || !this.getTarget()) {
      let best: CombatEnemy | null = null
      let bestD = Infinity
      for (const e of this.enemies) {
        if (!e.alive) continue
        const d = e.group.position.distanceToSquared(player.position)
        if (d < bestD) {
          bestD = d
          best = e
        }
      }
      this.targetId = best?.id ?? null
    }
  }

  private firePlayer(player: THREE.Object3D, w: WeaponDef, dmgMul = 1) {
    player.getWorldDirection(this.fwd)
    const origin = this.tmp.copy(player.position).addScaledVector(this.fwd, 5)
    const count = w.count ?? 1
    const spread = w.spread ?? 0
    const lock = this.getTarget()
    for (let i = 0; i < count; i++) {
      let dir = this.fwd.clone()
      // Soft aim-assist toward lock so pulse/plasma can connect in a dogfight
      if (lock && !w.spread) {
        const to = this.tmp2.copy(lock.group.position).sub(origin).normalize()
        dir.lerp(to, 0.85).normalize()
      }
      if (spread > 0) {
        dir.x += (Math.random() - 0.5) * spread
        dir.y += (Math.random() - 0.5) * spread
        dir.z += (Math.random() - 0.5) * spread
        dir.normalize()
      }
      this.spawnProjectile({
        origin: origin.clone(),
        dir,
        weapon: w,
        fromPlayer: true,
        damageMul: dmgMul,
      })
    }
    this.onSfx?.(`fire_${w.id}` as any)
  }

  private spawnProjectile(opts: {
    origin: THREE.Vector3
    dir: THREE.Vector3
    weapon: WeaponDef
    fromPlayer: boolean
    damageMul?: number
  }) {
    let p = this.projectiles.find((x) => !x.active)
    if (!p) {
      // Use a shared sphere for geometry — shape varies per weapon via scale/rotation
      const geo = new THREE.SphereGeometry(1, 6, 6)
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(geo, mat.clone())
      mesh.visible = false
      this.root.add(mesh)

      // Glow sprite — always on, follows the projectile
      const glowTex = this.makeGlowTexture()
      const glowMat = new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const glow = new THREE.Sprite(glowMat)
      glow.visible = false
      this.root.add(glow)

      // Missile body — cone nose + cylinder + fins
      const missileGroup = this.createMissileBody()
      missileGroup.visible = false
      this.root.add(missileGroup)

      // 3D body group for energy weapons (pulse, plasma, rail, flak)
      const bodyGroup = new THREE.Group()
      bodyGroup.visible = false
      this.root.add(bodyGroup)

      // Trail — 16-point ribbon behind the projectile
      const trailCount = 16
      const trailPos = new Float32Array(trailCount * 3)
      const trailGeo = new THREE.BufferGeometry()
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3))
      const trailMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.3,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      })
      const trail = new THREE.Points(trailGeo, trailMat)
      trail.visible = false
      this.root.add(trail)

      p = {
        active: false,
        mesh,
        bodyGroup,
        missileGroup,
        glow,
        trail,
        trailPos,
        trailIdx: 0,
        velocity: new THREE.Vector3(),
        life: 0,
        damage: 0,
        radius: 0.4,
        fromPlayer: true,
        homing: 0,
        pierce: false,
        hit: new Set(),
        weaponId: 'pulse',
        glowPhase: Math.random() * Math.PI * 2,
      }
      this.projectiles.push(p)
    }

    p.active = true
    p.weaponId = opts.weapon.id
    p.mesh.visible = true
    p.mesh.position.copy(opts.origin)
    p.mesh.rotation.set(0, 0, 0)
    p.missileGroup.visible = false
      p.bodyGroup.visible = false
    p.glow.visible = true
    p.glow.position.copy(opts.origin)
    p.trail!.visible = true
    p.trailIdx = 0
    // Fill trail with current position
    for (let i = 0; i < 16; i++) {
      p.trailPos[i * 3] = opts.origin.x
      p.trailPos[i * 3 + 1] = opts.origin.y
      p.trailPos[i * 3 + 2] = opts.origin.z
    }
    p.trail!.geometry.attributes.position.needsUpdate = true

    // Weapon-specific 3D body + glow + trail
    const mat = p.mesh.material as THREE.MeshBasicMaterial
    const glowMat = p.glow.material as THREE.SpriteMaterial
    const trailMat = p.trail!.material as THREE.PointsMaterial
    mat.color.setHex(opts.weapon.color)
    glowMat.color.setHex(opts.weapon.color)
    const w = opts.weapon
    switch (w.id) {
      case 'pulse': {
        // Crystal bolt — 3D hexagonal prism
        p.mesh.visible = false
        p.missileGroup.visible = false
      p.bodyGroup.visible = false
        this.buildBodyForWeapon('pulse', p.bodyGroup)
        p.bodyGroup.visible = true
        p.bodyGroup.position.copy(opts.origin)
        p.bodyGroup.lookAt(opts.origin.clone().add(opts.dir))
        p.bodyGroup.scale.setScalar(0.4)
        p.glow.scale.set(2, 2, 1)
        glowMat.opacity = 0.5
        trailMat.color.setHex(0x66ffee)
        trailMat.size = 0.25
        trailMat.opacity = 0.35
        break
      }
      case 'plasma': {
        // Glowing orb with rings — 3D torus rings
        p.mesh.visible = false
        p.missileGroup.visible = false
      p.bodyGroup.visible = false
        this.buildBodyForWeapon('plasma', p.bodyGroup)
        p.bodyGroup.visible = true
        p.bodyGroup.position.copy(opts.origin)
        p.bodyGroup.scale.setScalar(w.radius * 1.2)
        p.glow.scale.set(6, 6, 1)
        glowMat.opacity = 0.7
        trailMat.color.setHex(0xb44cff)
        trailMat.size = 0.55
        trailMat.opacity = 0.5
        break
      }
      case 'missile': {
        // Real missile body — cone + cylinder + fins + exhaust
        p.mesh.visible = false
        p.bodyGroup.visible = false
        p.missileGroup.visible = true
        p.missileGroup.position.copy(opts.origin)
        p.missileGroup.lookAt(opts.origin.clone().add(opts.dir))
        p.missileGroup.scale.setScalar(0.35)
        p.glow.scale.set(3, 3, 1)
        glowMat.opacity = 0.6
        trailMat.color.setHex(0xff8844)
        trailMat.size = 0.5
        trailMat.opacity = 0.55
        break
      }
      case 'rail': {
        // Ultra-thin lance — 3D hexagonal cylinder + shockwave ring
        p.mesh.visible = false
        p.missileGroup.visible = false
      p.bodyGroup.visible = false
        this.buildBodyForWeapon('rail', p.bodyGroup)
        p.bodyGroup.visible = true
        p.bodyGroup.position.copy(opts.origin)
        p.bodyGroup.lookAt(opts.origin.clone().add(opts.dir))
        p.bodyGroup.scale.setScalar(0.35)
        p.glow.scale.set(1.5, 1.5, 1)
        glowMat.opacity = 0.3
        trailMat.color.setHex(0xaaccff)
        trailMat.size = 0.15
        trailMat.opacity = 0.25
        break
      }
      case 'flak': {
        // Crystal shard — 3D octahedron
        p.mesh.visible = false
        p.missileGroup.visible = false
      p.bodyGroup.visible = false
        this.buildBodyForWeapon('flak', p.bodyGroup)
        p.bodyGroup.visible = true
        p.bodyGroup.position.copy(opts.origin)
        p.bodyGroup.lookAt(opts.origin.clone().add(opts.dir))
        p.bodyGroup.scale.setScalar(0.5)
        p.glow.scale.set(1.5, 1.5, 1)
        glowMat.opacity = 0.4
        trailMat.color.setHex(0xffdd55)
        trailMat.size = 0.2
        trailMat.opacity = 0.3
        break
      }
      default:
        p.mesh.scale.setScalar(w.radius)
    }
    // Face velocity direction
    p.mesh.lookAt(opts.origin.clone().add(opts.dir))

    p.velocity.copy(opts.dir).multiplyScalar(w.speed)
    p.life = w.life
    p.damage = w.damage * (opts.damageMul ?? 1)
    p.radius = w.radius * 2.2
    p.fromPlayer = opts.fromPlayer
    p.homing = w.homing ?? 0
    p.pierce = Boolean(w.pierce)
    p.hit.clear()
  }

  /** Small radial gradient texture for projectile glow. */
  private makeGlowTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.2, 'rgba(255,255,255,0.8)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.3)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
    const tex = new THREE.CanvasTexture(c)
    return tex
  }

  /** Realistic missile body: cone nose + cylinder body + 4 fins + exhaust flame. */
  private createMissileBody(): THREE.Group {
    const g = new THREE.Group()

    // Body — long cylinder
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.35, 3, 8)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x8899aa,
      metalness: 0.7,
      roughness: 0.25,
      emissive: 0x222233,
      emissiveIntensity: 0.3,
    })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.rotation.x = Math.PI / 2
    g.add(body)

    // Nose cone — pointed tip
    const noseGeo = new THREE.ConeGeometry(0.35, 0.9, 8)
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0xccddff,
      metalness: 0.8,
      roughness: 0.15,
      emissive: 0x333355,
      emissiveIntensity: 0.4,
    })
    const nose = new THREE.Mesh(noseGeo, noseMat)
    nose.rotation.x = Math.PI / 2
    nose.position.z = -1.95
    g.add(nose)

    // 4 fins at rear
    const finGeo = new THREE.BoxGeometry(0.04, 0.6, 0.7)
    const finMat = new THREE.MeshStandardMaterial({
      color: 0x667788,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0x111122,
      emissiveIntensity: 0.2,
    })
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(finGeo, finMat)
      fin.position.z = 1.3
      fin.position.y = 0.35
      fin.rotation.z = (i * Math.PI) / 2
      g.add(fin)
    }

    // Exhaust flame — bright cone behind
    const flameGeo = new THREE.ConeGeometry(0.25, 1.2, 6, 1, true)
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff8833,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const flame = new THREE.Mesh(flameGeo, flameMat)
    flame.rotation.x = Math.PI / 2
    flame.position.z = 2.0
    flame.name = 'flame'
    g.add(flame)

    // Inner bright core
    const coreGeo = new THREE.ConeGeometry(0.08, 0.6, 6, 1, true)
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const core = new THREE.Mesh(coreGeo, coreMat)
    core.rotation.x = Math.PI / 2
    core.position.z = 2.0
    core.name = 'core'
    g.add(core)

    return g
  }

  /** Build 3D body for a weapon type — called once per projectile slot. */
  private buildBodyForWeapon(weaponId: WeaponId, g: THREE.Group) {
    // Clear existing children
    while (g.children.length > 0) g.remove(g.children[0])

    switch (weaponId) {
      case 'pulse': {
        // Crystal bolt — thin hexagonal prism with bright core
        const coreGeo = new THREE.CylinderGeometry(0.15, 0.15, 2.2, 6)
        const coreMat = new THREE.MeshBasicMaterial({
          color: 0x66ffee,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const core = new THREE.Mesh(coreGeo, coreMat)
        core.rotation.x = Math.PI / 2
        g.add(core)

        // Outer shell — slightly larger, semi-transparent
        const shellGeo = new THREE.CylinderGeometry(0.28, 0.28, 2.4, 6)
        const shellMat = new THREE.MeshBasicMaterial({
          color: 0x66ffee,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const shell = new THREE.Mesh(shellGeo, shellMat)
        shell.rotation.x = Math.PI / 2
        g.add(shell)

        // Tip cone
        const tipGeo = new THREE.ConeGeometry(0.15, 0.5, 6)
        const tipMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const tip = new THREE.Mesh(tipGeo, tipMat)
        tip.rotation.x = Math.PI / 2
        tip.position.z = -1.35
        g.add(tip)
        break
      }
      case 'plasma': {
        // Glowing orb with 3 rotating rings
        const coreGeo = new THREE.SphereGeometry(0.55, 12, 12)
        const coreMat = new THREE.MeshBasicMaterial({
          color: 0xb44cff,
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const core = new THREE.Mesh(coreGeo, coreMat)
        g.add(core)

        // 3 rings at different angles
        const ringGeo = new THREE.TorusGeometry(0.7, 0.08, 8, 16)
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xdd88ff,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        for (let i = 0; i < 3; i++) {
          const ring = new THREE.Mesh(ringGeo, ringMat)
          ring.rotation.x = (i * Math.PI) / 3 + Math.PI / 2
          ring.rotation.y = i * 0.4
          ring.name = `ring_${i}`
          g.add(ring)
        }

        // Inner bright core
        const innerGeo = new THREE.SphereGeometry(0.2, 8, 8)
        const innerMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const inner = new THREE.Mesh(innerGeo, innerMat)
        g.add(inner)
        break
      }
      case 'rail': {
        // Ultra-thin hexagonal lance with bright core
        const coreGeo = new THREE.CylinderGeometry(0.06, 0.06, 4.5, 6)
        const coreMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const core = new THREE.Mesh(coreGeo, coreMat)
        core.rotation.x = Math.PI / 2
        g.add(core)

        // Outer shell
        const shellGeo = new THREE.CylinderGeometry(0.15, 0.15, 4.5, 6)
        const shellMat = new THREE.MeshBasicMaterial({
          color: 0xaaccff,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const shell = new THREE.Mesh(shellGeo, shellMat)
        shell.rotation.x = Math.PI / 2
        g.add(shell)

        // Shockwave ring
        const ringGeo = new THREE.TorusGeometry(0.22, 0.03, 6, 12)
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xaaccff,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const ring = new THREE.Mesh(ringGeo, ringMat)
        ring.rotation.x = Math.PI / 2
        ring.name = 'shockwave'
        g.add(ring)
        break
      }
      case 'flak': {
        // Small faceted crystal shard
        const geo = new THREE.OctahedronGeometry(0.25, 0)
        const mat = new THREE.MeshBasicMaterial({
          color: 0xffdd55,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const shard = new THREE.Mesh(geo, mat)
        g.add(shard)

        // Wireframe overlay for faceted look
        const wireGeo = new THREE.OctahedronGeometry(0.26, 0)
        const wireMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          wireframe: true,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const wire = new THREE.Mesh(wireGeo, wireMat)
        g.add(wire)

        // Small glow spike
        const spikeGeo = new THREE.ConeGeometry(0.12, 0.4, 4)
        const spikeMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const spike = new THREE.Mesh(spikeGeo, spikeMat)
        spike.rotation.x = Math.PI / 2
        spike.position.z = 0.2
        g.add(spike)
        break
      }
    }
  }

  private tickCampaign(dt: number, near: THREE.Vector3) {
    if (this.phase === 'done') return

    if (this.phase === 'clear') {
      this.clearTimer -= dt
      if (this.clearTimer <= 0) {
        if (this.level.id >= 20) {
          this.phase = 'done'
          return
        }
        const next = this.level.id + 1
        const save = loadCampaign()
        save.level = next
        saveCampaign(save)
        this.startLevel(next)
        this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 40)
        this.shield = this.shieldMax
      }
      return
    }

    const alive = this.enemies.filter((e) => e.alive)
    if (this.phase === 'wave') {
      if (alive.length === 0) {
        if (this.waveIndex < this.level.waves) {
          this.spawnTimer -= dt
          if (this.spawnTimer <= 0) {
            this.spawnCampaignWave(near)
            this.waveIndex += 1
            this.wave = this.waveIndex
            this.spawnTimer = 2.2
          }
        } else {
          this.phase = 'boss'
          this.spawnBoss(near)
        }
      }
    } else if (this.phase === 'boss' && alive.length === 0) {
      this.bossDown = true
      this.tryCompleteLevel()
    }
  }

  private objectiveProgress(kind: ObjectiveDef['kind']): number {
    switch (kind) {
      case 'kills':
        return this.levelKills
      case 'boss':
        return this.bossDown ? 1 : 0
      case 'pickups':
        return this.levelPickups
      case 'score':
        return this.score - this.levelScoreStart
    }
  }

  private objectivesMet(): boolean {
    return this.level.objectives
      .filter((o) => o.required)
      .every((o) => this.objectiveProgress(o.kind) >= o.target)
  }

  private tryCompleteLevel() {
    if (this.phase === 'clear' || this.phase === 'done') return
    if (!this.bossDown) return
    // Ensure required pickup objectives remain completable after boss falls
    const needPickup = this.level.objectives.find((o) => o.kind === 'pickups' && o.required)
    if (needPickup && this.levelPickups < needPickup.target) {
      const active = this.pickups.some((p) => p.active)
      if (!active && this.playerRef) this.spawnPowerPickup(this.playerRef.position.clone())
    }
    if (!this.objectivesMet()) return
    this.completeLevel()
  }

  getObjectiveLines(): { label: string; done: boolean; detail: string }[] {
    return this.level.objectives.map((o) => {
      const cur = this.objectiveProgress(o.kind)
      const done = cur >= o.target
      return {
        label: o.label,
        done,
        detail: `${Math.min(cur, o.target)}/${o.target}${o.required ? '' : ' ★'}`,
      }
    })
  }

  private spawnCampaignWave(near: THREE.Vector3) {
    const n = this.level.enemiesPerWave
    for (let i = 0; i < n; i++) {
      const base = ENEMY_DEFS[Math.floor(Math.random() * ENEMY_DEFS.length)]
      const scaled: EnemyDef = {
        ...base,
        hp: Math.round(base.hp * this.level.enemyHpMul),
        speed: base.speed * this.level.enemySpeedMul,
        score: Math.round(base.score * (1 + this.level.id * 0.05)),
      }
      this.spawnEnemy(scaled, near, {
        dmgMul: this.level.enemyDmgMul,
      })
    }
  }

  private spawnBoss(near: THREE.Vector3) {
    const b = this.level.boss
    const def: EnemyDef = {
      kind: 'heavy',
      label: `BOSS ${b.name}`,
      craft: b.craft,
      pack: 'quaternius',
      hp: b.hp,
      speed: b.speed,
      scale: b.scale,
      color: b.color,
      weapon: b.weapon,
      score: b.score,
      ai: this.level.id >= 14 ? 'dogfight' : this.level.id >= 8 ? 'strafe' : 'tank',
    }
    this.spawnEnemy(def, near, {
      isBoss: true,
      dmgMul: this.level.enemyDmgMul * 1.35,
      fireRateMul: b.fireRateMul,
      dist: 200,
    })
  }

  private completeLevel() {
    const reward = this.level.clearReward
    const save = loadCampaign()
    save.highestCleared = Math.max(save.highestCleared, this.level.id)
    save.upgrades.push(reward) // stack — each clear grants one upgrade roll
    save.level = Math.min(20, this.level.id + 1)
    saveCampaign(save)
    this.rebuildUpgrades()
    this.playerHp = Math.min(this.playerMaxHp, this.playerHp)
    this.shield = Math.min(this.shieldMax, this.shield)
    this.phase = 'clear'
    this.clearTimer = 3.2
    this.onSfx?.('clear')
    this.onLevelClear?.(this.level.id, reward)
  }

  private spawnEnemy(
    def: EnemyDef,
    near: THREE.Vector3,
    opts?: { isBoss?: boolean; dmgMul?: number; fireRateMul?: number; dist?: number },
  ) {
    const key = `${def.pack}:${def.craft}`
    const template = this.craftCache.get(key) ?? this.makeFallbackHull(def.color)
    const group = template.clone(true)
    group.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      if (Array.isArray(m.material)) m.material = m.material.map((mat) => mat.clone())
      else m.material = m.material.clone()
      // Enemies don't cast shadows — negligible visual impact, saves one shadow
      // map render per enemy (huge when many ships are on screen).
      m.castShadow = false
      m.receiveShadow = false
      const mat = m.material as THREE.MeshStandardMaterial
      if (!mat || !('color' in mat)) return
      // Light faction tint — keep Quaternius albedo readable
      const accent = new THREE.Color(def.color)
      mat.color.lerp(accent, opts?.isBoss ? 0.18 : 0.1)
      mat.emissive = accent.clone().multiplyScalar(0.12)
      mat.emissiveIntensity = opts?.isBoss ? 0.22 : 0.12
      mat.envMapIntensity = 0.95
      mat.metalness = THREE.MathUtils.clamp(mat.metalness ?? 0.45, 0.25, 0.6)
      mat.roughness = THREE.MathUtils.clamp(mat.roughness ?? 0.45, 0.3, 0.58)
      mat.needsUpdate = true
    })
    group.scale.multiplyScalar(def.scale)

    const ang = Math.random() * Math.PI * 2
    const dist = opts?.dist ?? 140 + Math.random() * 180
    const pos = new THREE.Vector3(
      near.x + Math.cos(ang) * dist,
      near.y + (Math.random() - 0.5) * 50,
      near.z + Math.sin(ang) * dist,
    )
    if (pos.length() < 160) pos.setLength(160 + Math.random() * 40)
    group.position.copy(pos)

    this.root.add(group)
    this.enemies.push({
      id: this.nextId++,
      def,
      group,
      hp: def.hp,
      maxHp: def.hp,
      alive: true,
      cooldown: 0.5 + Math.random(),
      velocity: new THREE.Vector3(),
      wander: Math.random() * Math.PI * 2,
      isBoss: opts?.isBoss,
      dmgMul: opts?.dmgMul ?? 1,
      fireRateMul: opts?.fireRateMul ?? 1,
    })
  }

  private updateEnemies(dt: number, player: THREE.Object3D, playerVel: THREE.Vector3) {
    for (const e of this.enemies) {
      if (!e.alive) continue
      e.cooldown -= dt
      e.wander += dt

      const dir = this.tmp.copy(player.position).sub(e.group.position)
      const dist = dir.length()
      dir.normalize()

      let desired = this.tmp3
      desired.set(0, 0, 0)
      switch (e.def.ai) {
        case 'dogfight':
          desired.copy(dir).multiplyScalar(e.def.speed * (dist > 160 ? 1.35 : 1))
          desired.addScaledVector(this.sideJink(e), e.def.speed * 0.45)
          break
        case 'strafe':
          desired.copy(dir).multiplyScalar(e.def.speed * (dist > 160 ? 1.2 : 0.55))
          desired.addScaledVector(this.sideJink(e), e.def.speed * 0.9)
          if (dist < 70) desired.addScaledVector(dir, -e.def.speed * 0.8)
          break
        case 'sniper':
          if (dist < 160) desired.copy(dir).multiplyScalar(-e.def.speed * 0.7)
          else desired.copy(dir).multiplyScalar(e.def.speed * 0.85)
          desired.addScaledVector(this.sideJink(e), e.def.speed * 0.5)
          break
        case 'tank':
          // Orbit / hold standoff — never ram the player
          if (dist < 90) desired.copy(dir).multiplyScalar(-e.def.speed * 0.9)
          else if (dist > 140) desired.copy(dir).multiplyScalar(e.def.speed * 0.55)
          else desired.addScaledVector(this.sideJink(e), e.def.speed * 0.85)
          break
        case 'swarm':
          desired.copy(dir).multiplyScalar(e.def.speed * (dist > 140 ? 1.4 : 1))
          desired.x += Math.sin(e.wander * 5) * 30
          desired.y += Math.cos(e.wander * 4) * 24
          break
      }

      // Standoff radius scales with hull size (bosses are huge)
      const keepOut = (e.isBoss ? 34 : 18) + e.def.scale * 15
      if (dist < keepOut * 1.55) {
        desired.copy(dir).multiplyScalar(-Math.max(e.def.speed, 34) * 1.5)
        desired.addScaledVector(this.sideJink(e), e.def.speed * 1.05)
      }

      e.velocity.lerp(desired, 1 - Math.pow(0.05, dt))
      e.group.position.addScaledVector(e.velocity, dt)
      // Keep dogfights outside the sun corona
      if (e.group.position.length() < 150) {
        e.group.position.setLength(150 + Math.random() * 20)
        e.velocity.addScaledVector(e.group.position.clone().normalize(), 20)
      }

      // Hard separation — recalculate after move
      const sep = this.tmp2.copy(player.position).sub(e.group.position)
      const sepDist = sep.length()
      if (sepDist < 0.001) {
        e.group.position.x += keepOut
      } else if (sepDist < keepOut) {
        sep.multiplyScalar(1 / sepDist)
        const push = keepOut - sepDist
        e.group.position.addScaledVector(sep, -push)
        // Nudge player so hull/camera don't stay buried in boss mesh
        player.position.addScaledVector(sep, -push * 0.65)
        // Kill closing speed on both
        const closing = e.velocity.dot(sep)
        if (closing > 0) e.velocity.addScaledVector(sep, -closing)
        const pClose = playerVel.dot(sep)
        if (pClose < 0) playerVel.addScaledVector(sep, -pClose * 0.85)
      }
      // face player
      e.group.lookAt(player.position)

      const w = WEAPONS.find((x) => x.id === e.def.weapon)!
      const fightDist = e.group.position.distanceTo(player.position)
      const range =
        e.def.ai === 'sniper' ? 280 : e.def.ai === 'tank' || e.isBoss ? 200 : e.def.weapon === 'missile' ? 200 : 130
      if (e.cooldown <= 0 && fightDist < range && fightDist > keepOut * 0.85) {
        const lead = this.tmp
          .copy(player.position)
          .addScaledVector(playerVel, fightDist / Math.max(w.speed, 1))
        const shotDir = lead.sub(e.group.position).normalize()
        const baseDmg = w.id === 'rail' || w.id === 'missile' ? 0.14 : 0.22
        const bossBonus = e.isBoss ? 1.45 : 1
        this.spawnProjectile({
          origin: e.group.position.clone().addScaledVector(shotDir, 3),
          dir: shotDir,
          weapon: {
            ...w,
            damage: Math.max(3, w.damage * baseDmg * (e.dmgMul ?? 1) * bossBonus),
            count: w.id === 'flak' ? (e.isBoss ? 6 : 4) : w.count,
          },
          fromPlayer: false,
        })
        const fireMul = e.fireRateMul ?? 1
        e.cooldown = (w.cooldown * (e.isBoss ? 1.05 : 1.7 + Math.random())) / fireMul
      }
    }
  }

  private sideJink(e: CombatEnemy) {
    return this.right.set(Math.sin(e.wander * 2.1), Math.cos(e.wander * 1.7) * 0.4, Math.cos(e.wander * 2.1))
  }

  private updateProjectiles(dt: number, player: THREE.Object3D, _playerVel: THREE.Vector3 | null) {
    // Build a coarse spatial grid of enemies for O(1) hit lookups.
    // Cell size ~20 units — most enemy hit radii are <12 so 1-2 cells per bullet.
    const GRID = 20
    const grid = new Map<string, CombatEnemy[]>()
    const gridKey = (x: number, y: number, z: number) =>
      `${(x / GRID) | 0},${(y / GRID) | 0},${(z / GRID) | 0}`
    for (const e of this.enemies) {
      if (!e.alive) continue
      const p = e.group.position
      const key = gridKey(p.x, p.y, p.z)
      let bucket = grid.get(key)
      if (!bucket) {
        bucket = []
        grid.set(key, bucket)
      }
      bucket.push(e)
    }

    for (const p of this.projectiles) {
      if (!p.active) continue
      p.life -= dt
      if (p.life <= 0) {
        p.active = false
        p.mesh.visible = false
        p.missileGroup.visible = false
      p.bodyGroup.visible = false
        p.glow.visible = false
        p.trail!.visible = false
        continue
      }

      if (p.homing > 0) {
        const targetPos = p.fromPlayer ? this.getTarget()?.group.position : player.position
        if (targetPos) {
          const spd = Math.max(p.velocity.length(), 70)
          const want = this.tmp.copy(targetPos).sub(p.mesh.position).normalize()
          p.velocity.normalize().lerp(want, Math.min(1, dt * p.homing)).setLength(spd)
        }
      }

      p.mesh.position.addScaledVector(p.velocity, dt)
      p.mesh.lookAt(p.mesh.position.clone().add(p.velocity))
      p.glow.position.copy(p.mesh.position)

      // Missile / 3D body follows same position + faces velocity
      if (p.missileGroup.visible) {
        p.missileGroup.position.copy(p.mesh.position)
        p.missileGroup.lookAt(p.mesh.position.clone().add(p.velocity))
      }
      if (p.bodyGroup.visible) {
        p.bodyGroup.position.copy(p.mesh.position)
        p.bodyGroup.lookAt(p.mesh.position.clone().add(p.velocity))
      }

      // Pulsing glow — oscillation makes projectiles feel alive
      p.glowPhase += dt * 12

      // Trail: shift all positions forward, add new at current
      {
        const pos = p.mesh.position
        const arr = p.trailPos
        const idx = p.trailIdx
        arr[idx * 3] = pos.x
        arr[idx * 3 + 1] = pos.y
        arr[idx * 3 + 2] = pos.z
        p.trailIdx = (idx + 1) % 16
        p.trail!.geometry.attributes.position.needsUpdate = true
      }

      if (p.fromPlayer) {
        // Check only the 3x3x3 cells around the bullet
        const pos = p.mesh.position
        const cx = (pos.x / GRID) | 0
        const cy = (pos.y / GRID) | 0
        const cz = (pos.z / GRID) | 0
        let hitSomething = false
        for (let dx = -1; dx <= 1 && !hitSomething; dx++) {
          for (let dy = -1; dy <= 1 && !hitSomething; dy++) {
            for (let dz = -1; dz <= 1 && !hitSomething; dz++) {
              const key = `${cx + dx},${cy + dy},${cz + dz}`
              const bucket = grid.get(key)
              if (!bucket) continue
              for (const e of bucket) {
                if (!e.alive || p.hit.has(e.id)) continue
                const r = p.radius + 8.5 * e.def.scale
                if (pos.distanceToSquared(e.group.position) < r * r) {
                  this.damageEnemy(e, p.damage)
                  p.hit.add(e.id)
                  if (!p.pierce) {
                    p.active = false
                    p.mesh.visible = false
                    p.missileGroup.visible = false
      p.bodyGroup.visible = false
                    p.glow.visible = false
                    p.trail!.visible = false
                    hitSomething = true
                    break
                  }
                }
              }
            }
          }
        }
      } else {
        const r = p.radius + 3.2
        if (p.mesh.position.distanceToSquared(player.position) < r * r) {
          this.fx.spawnHitSpark(p.mesh.position.clone(), 0xff6644)
          this.damagePlayer(p.damage, p.mesh.position)
          p.active = false
          p.mesh.visible = false
        }
      }
    }
  }

  private damageEnemy(e: CombatEnemy, dmg: number) {
    e.hp -= dmg
    this.fx.spawnHitSpark(e.group.position.clone(), e.def.color)
    e.group.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && (m.material as THREE.MeshStandardMaterial).emissive) {
        ;(m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.9
      }
    })
    if (e.hp <= 0) {
      this.fx.spawnExplosion(e.group.position.clone(), {
        scale: e.isBoss ? 1.5 : 0.9,
        color: e.def.color,
        big: Boolean(e.isBoss),
      })
      this.onSfx?.('boom')
      e.alive = false
      e.group.visible = false
      this.kills += 1
      this.sortieKills += 1
      if (!e.isBoss) this.levelKills += 1
      this.score += e.def.score
      this.onKillReward?.(e.def.score)
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 4)
      this.killsSincePickup += 1
      if (this.killsSincePickup >= PICKUP_EVERY) {
        this.killsSincePickup = 0
        this.spawnPowerPickup(e.group.position.clone())
      }
    } else {
      this.onSfx?.('hit')
    }
  }

  private spawnPowerPickup(pos: THREE.Vector3) {
    const kinds: PickupKind[] = ['rof', 'dmg', 'crit']
    const kind = kinds[Math.floor(Math.random() * kinds.length)]
    const colors = { rof: 0x66ffcc, dmg: 0xffaa44, crit: 0xff66ee }
    const color = colors[kind]

    const mesh = new THREE.Group()
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.2, 0),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    )
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.4, 0),
      new THREE.MeshBasicMaterial({
        color,
        wireframe: true,
        transparent: true,
        opacity: 0.55,
      }),
    )
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.2, 0.18, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }),
    )
    ring.rotation.x = Math.PI / 2
    mesh.add(core, shell, ring)
    // Spawn beside the player — magnet finishes the scoop
    if (this.playerRef) {
      this.playerRef.getWorldDirection(this.fwd)
      const side = this.right.set(1, 0, 0).applyQuaternion(this.playerRef.quaternion)
      mesh.position
        .copy(this.playerRef.position)
        .addScaledVector(this.fwd, 14)
        .addScaledVector(side, 8)
      mesh.position.y += 3
    } else {
      mesh.position.copy(pos)
      mesh.position.y += 6
    }

    const light = new THREE.PointLight(color, 3.4, 70, 2)
    mesh.add(light)
    this.root.add(mesh)

    this.pickups.push({
      active: true,
      kind,
      mesh,
      light,
      life: PICKUP_LIFE,
      spin: 0,
    })
  }

  private updatePickups(dt: number, playerPos: THREE.Vector3) {
    for (const p of this.pickups) {
      if (!p.active) continue
      p.life -= dt
      p.spin += dt
      p.mesh.rotation.y = p.spin * 2.4
      p.mesh.rotation.x = Math.sin(p.spin * 1.7) * 0.35
      p.mesh.position.y += Math.sin(p.spin * 3) * 0.02
      p.light.intensity = 2.6 + Math.sin(p.spin * 6) * 1.1
      if (p.life <= 0) {
        p.active = false
        p.mesh.visible = false
        this.root.remove(p.mesh)
        continue
      }
      let dist = p.mesh.position.distanceTo(playerPos)
      if (dist < PICKUP_MAGNET) {
        // Strong magnet — scoop into the ship
        p.mesh.position.lerp(playerPos, Math.min(1, dt * 4.5))
        dist = p.mesh.position.distanceTo(playerPos)
      }
      if (dist < PICKUP_RADIUS) {
        this.applyPickup(p)
      }
    }
  }

  private applyPickup(p: PowerPickup) {
    p.active = false
    p.mesh.visible = false
    this.root.remove(p.mesh)
    this.fx.spawnExplosion(p.mesh.position.clone(), {
      scale: 0.7,
      color: p.kind === 'rof' ? 0x66ffcc : p.kind === 'dmg' ? 0xffaa44 : 0xff66ee,
      big: false,
    })

    let id: WeaponUpgradeId
    let label: string
    if (p.kind === 'rof') {
      id = 'rof_all'
      label = '射击升级 · 射速 +10%'
    } else if (p.kind === 'dmg') {
      const map: Record<number, WeaponUpgradeId> = {
        0: 'dmg_pulse',
        1: 'dmg_plasma',
        2: 'dmg_missile',
        3: 'dmg_rail',
        4: 'dmg_flak',
      }
      id = map[this.weaponIndex] ?? 'dmg_pulse'
      label = '射击升级 · 当前武器伤害↑'
    } else {
      id = 'crit_core'
      label = '射击升级 · 全武器伤害 +8%'
    }

    this.pickupIds.push(id)
    this.rebuildUpgrades()
    this.powerLevel += 1
    this.levelPickups += 1
    this.onSfx?.('pickup')
    this.onPickup?.(label)
    this.tryCompleteLevel()
  }

  private invuln = 0

  private damagePlayer(dmg: number, hitPos?: THREE.Vector3) {
    if (this.invuln > 0) return
    this.hitFlash = 0.28
    this.onSfx?.('damage')
    const at = hitPos ?? this.playerRef?.position
    if (at) this.fx.spawnHitSpark(at.clone(), 0x66ccff)
    let remain = dmg
    if (this.shield > 0) {
      const absorb = Math.min(this.shield, remain)
      this.shield -= absorb
      remain -= absorb
    }
    this.playerHp = Math.max(0, this.playerHp - remain)
    if (this.playerHp <= 0 && at) {
      this.fx.spawnExplosion(at.clone(), { scale: 1.4, color: 0xff5522, big: true })
      this.onSfx?.('boom')
    }
  }

  /** Apply hangar ship durability before flight / after equip. */
  applyLoadout(hp: number, shield: number) {
    this.baseHull = hp
    this.baseShield = shield
    this.playerMaxHp = hp + this.upgradeState.hullBonus
    this.shieldMax = shield + this.upgradeState.shieldBonus
    this.playerHp = this.playerMaxHp
    this.shield = this.shieldMax
  }

  /** Clear projectiles and restore player after wreck. */
  respawn() {
    this.playerHp = this.playerMaxHp
    this.shield = this.shieldMax
    this.invuln = 4.5
    this.hitFlash = 0
    for (const p of this.projectiles) {
      p.active = false
      p.mesh.visible = false
      p.missileGroup.visible = false
      p.bodyGroup.visible = false
    }
  }

  statusLine() {
    const w = this.weapon
    const t = this.getTarget()
    const charge =
      w.charge && this.charge > 0 ? ` CHG${Math.floor(this.charge * 100)}%` : ''
    const boss = this.enemies.find((e) => e.alive && e.isBoss)
    const phaseLabel =
      this.phase === 'boss'
        ? 'BOSS'
        : this.phase === 'clear'
          ? 'CLEAR'
          : this.phase === 'done'
            ? 'DONE'
            : `W${this.waveIndex}/${this.level.waves}`
    return {
      weapon: `${w.name}${charge}`,
      hp: this.playerHp,
      shield: this.shield,
      kills: this.kills,
      score: this.score,
      target: t ? `${t.def.label} ${Math.ceil(t.hp)}HP` : 'NO LOCK',
      wave: this.wave,
      level: this.level.id,
      chapter: this.level.chapterName,
      brief: this.level.brief,
      phase: phaseLabel,
      bossHp: boss ? `${Math.ceil(boss.hp)}/${boss.maxHp}` : null,
      hitFlash: this.hitFlash > 0,
      dead: this.playerHp <= 0,
      power: this.powerLevel,
      objectives: this.getObjectiveLines(),
    }
  }
}
