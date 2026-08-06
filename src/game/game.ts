import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { decorateStationWithKenney, installSpaceEnv, loadShipHull } from './assets'
import { gameAudio } from './audio'
import { loadCampaign, saveCampaign, upgradeDef } from './campaign'
import { Autopilot } from './autopilot'
import { CombatSystem } from './combat'
import { createGodRaysPass, updateGodRaysPass } from './godrays'
import { createCinematicPass, updateCinematicPass } from './postfx'
import { grantKillCredits, mountHangar } from './hangar'
import { HUD } from './hud'
import { Input } from './input'
import { createPlayReport, type PlayReport, type PlaySession } from './playtest'
import { isFullVersion, TRIAL_LEVELS } from './paid'
import { environmentForLevel } from './procedural'
import { Ship } from './ship'
import { addHangarCredits, getSelectedShipId, getShipDef, isShipUnlocked, type ShipDef } from './ships'
import { SurfaceTerrain } from './terrain'
import { UiPanels } from './ui-panels'
import { Walker } from './walker'
import { World } from './world'

type Mode = 'flight' | 'surface' | 'station'

/** 精炼汇率：每单位货物价值换取机库积分。 */
const REFINE_RATE = 8

export class Game {
  private renderer: THREE.WebGLRenderer
  private composer: EffectComposer
  private cinematicPass: ReturnType<typeof createCinematicPass>
  private godRaysPass = createGodRaysPass()
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(70, 1, 0.1, 8000)
  private input: Input
  private hud = new HUD()
  private world: World
  private ship = new Ship()
  private walker = new Walker()
  private terrain: SurfaceTerrain | null = null
  private mode: Mode = 'flight'
  private cargo = 0
  private clock = new THREE.Clock()
  private running = false
  private landedBodyId: string | null = null
  private tmp = new THREE.Vector3()
  private sunWorld = new THREE.Vector3(0, 0, 0)
  private combat = new CombatSystem()
  private combatReady = false
  private autopilot: Autopilot | null = null
  private playReport: PlayReport | null = null
  private sessionIndex = 0
  private sessionTimer = 0
  /** Wall-clock start of current autotest session (immune to frame-rate loss). */
  private sessionStartWall = 0
  private sessionDeaths = 0
  private sessionKillsStart = 0
  private sessionScoreStart = 0
  private wasDead = false
  private bgThemeLevel = 0
  private assetsReady = false
  private autotestTimeout = 18
  private equippedShipId = getSelectedShipId()
  private hullCache = new Map<string, THREE.Group>()
  private equipToken = 0
  readonly audio = gameAudio
  private ui: UiPanels
  private hangarRefresh: (() => void) | null = null
  private pausedHint = false

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.48
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    // Brighter, more reflective PBR — envMap from scene makes metals pop
    this.scene.environmentIntensity = 0.8

    this.scene.fog = new THREE.FogExp2(0x0c1424, 0.000055)
    this.scene.background = new THREE.Color(0x070b14)
    installSpaceEnv(this.renderer, this.scene)
    this.world = new World(this.scene)
    this.scene.add(this.ship.group)
    this.scene.add(this.combat.root)
    // Title hangar showcase near station light
    this.ship.group.position.set(40, 55, 280)
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    // Subtle bloom — half-res, only the brightest parts glow
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2),
      0.45,
      0.65,
      0.9,
    )
    ;(bloomPass as any).threshold = 0.85
    this.composer.addPass(bloomPass)
    this.composer.addPass(this.godRaysPass)
    // Film grain — adds "cinematic" texture, cheap (one full-screen triangle)
    const filmPass = new FilmPass(0.2, false)
    this.composer.addPass(filmPass)
    // Cinematic grade — vignette + chromatic aberration + saturation/contrast
    this.cinematicPass = createCinematicPass()
    this.composer.addPass(this.cinematicPass)
    this.composer.addPass(new OutputPass())

    this.input = new Input(canvas)
    window.addEventListener('resize', this.onResize)
    this.onResize()

    this.ui = new UiPanels({
      onTutorialLaunch: () => {
        // Tutorial button doubles as launch — jump straight into combat
        document.getElementById('launch-btn')?.click()
      },
      onSettingsChange: (s) => {
        this.input.setSensitivityMul(s.lookSensitivity)
      },
    })
    // Apply persisted sensitivity right away — it may pre-date this build.
    this.input.setSensitivityMul(this.ui.current.lookSensitivity)

    const begin = () => {
      if (this.running) return
      gameAudio.resume()
      gameAudio.play('ui')
      const def = getShipDef(getSelectedShipId() || this.equippedShipId)
      this.running = true
      this.ship.velocity.set(0, 0, 0)
      this.ship.group.position.set(-380, 60, -220)
      {
        const face = this.tmp.set(0, 40, 340).sub(this.ship.group.position).normalize()
        this.ship.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face)
        this.ship.group.rotation.setFromQuaternion(this.ship.group.quaternion)
      }
      this.hud.hideTitle()
      this.applyShipLoadout(def)
      this.hud.toastMessage(`${def.name} · ${this.combat.statusLine().chapter ?? '起飞'}`, 3)
      // Swap the real hull in the background — never block launch on slow links.
      void this.equipShipHull(def, true)
    }
    document.getElementById('launch-btn')?.addEventListener('click', begin)

    const params = new URLSearchParams(window.location.search)
    const autotest = Number(params.get('autotest') || '0')
    this.autotestTimeout = Math.max(3, Number(params.get('autotestTimeout') || '18'))
    window.__GAME__ = this
    if (autotest > 0) {
      this.autopilot = new Autopilot()
      this.playReport = createPlayReport(autotest)
      window.__PLAYTEST__ = this.playReport
      this.ui.forceReady()
      // Wait for hull/combat assets before launching (avoids headless race)
      const waitLaunch = () => {
        if (this.assetsReady && this.combatReady) begin()
        else window.setTimeout(waitLaunch, 120)
      }
      window.setTimeout(waitLaunch, 200)
    } else {
      const hangar = mountHangar((def) => {
        void this.previewShip(def)
      })
      this.hangarRefresh = hangar.refresh
    }

    this.combat.onKillReward = (score) => {
      grantKillCredits(score)
    }
    this.combat.onLevelClear = (level, reward) => {
      const u = upgradeDef(reward)
      this.hud.toastMessage(`关卡 ${level} 通关 · 武器升级：${u.title}（${u.blurb}）`, 3.5)
      grantKillCredits(200 + level * 40)
    }
    this.combat.onPaywall = () => {
      gameAudio.play('ui')
      this.hud.toastMessage(
        `第一章试玩结束 · 解锁完整版继续 20 关战役（点击右上角设置 → 解锁完整版）`,
        6,
      )
      // Let the hangar UI know it can surface the upgrade offer.
      this.hangarRefresh?.()
    }
    this.combat.onPickup = (label) => {
      this.hud.toastMessage(label, 2.2)
    }
    this.combat.onSfx = (kind) => gameAudio.play(kind)

    void this.loadKenneyAssets()
  }

  private applyShipLoadout(def: ShipDef) {
    this.combat.applyLoadout(def.hp, def.shield)
    this.ship.setSpeedMul(def.speedMul)
  }

  private async previewShip(def: ShipDef) {
    if (this.running) return
    await this.equipShipHull(def, isShipUnlocked(def.id))
  }

  private async equipShipHull(def: ShipDef, markEquipped = true) {
    const token = ++this.equipToken
    try {
      let craft = this.hullCache.get(def.id)
      if (!craft) {
        craft = await loadShipHull(def)
        this.hullCache.set(def.id, craft)
      }
      if (token !== this.equipToken) return
      const prev = this.ship.group.position.clone()
      this.scene.remove(this.ship.group)
      const hull = craft.clone(true)
      hull.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        if (Array.isArray(m.material)) m.material = m.material.map((mat) => mat.clone())
        else if (m.material) m.material = m.material.clone()
      })
      hull.userData.kenney = true
      this.ship = new Ship(hull)
      this.ship.group.position.copy(prev)
      this.ship.setSpeedMul(def.speedMul)
      this.scene.add(this.ship.group)
      if (markEquipped) {
        this.equippedShipId = def.id
        this.applyShipLoadout(def)
      }
    } catch (err) {
      console.warn('Ship hull load failed', def.id, err)
    }
  }

  /** Update the boot progress bar + label on the title card. */
  private setBootProgress(pct: number, label?: string) {
    const fill = document.getElementById('boot-fill') as HTMLElement | null
    if (fill) fill.style.width = `${Math.max(0, Math.min(100, pct))}%`
    if (label) {
      const el = document.getElementById('boot-text')
      if (el) el.textContent = label
    }
  }

  private async loadKenneyAssets() {
    // Free trial: clamp any save past the trial into the playable range.
    if (!isFullVersion()) {
      const save = loadCampaign()
      if (save.level > TRIAL_LEVELS) {
        save.level = TRIAL_LEVELS
        saveCampaign(save)
      }
    }
    // Ship hull and station decoration are cosmetic — pre-warm them but never
    // block combat readiness on slow asset links.
    this.setBootProgress(15, '正在加载游戏资源…')
    try {
      const def = getShipDef(getSelectedShipId())
      this.setBootProgress(35, '加载飞船模型…')
      void this.equipShipHull(def).catch(() => {})
    } catch {
      /* ignore */
    }
    this.setBootProgress(50, '加载空间站…')
    void decorateStationWithKenney(this.world.station).catch(() => {})
    try {
      this.setBootProgress(70, '初始化战斗系统…')
      await this.combat.init()
    } catch (err) {
      console.warn('Combat init failed', err)
    }
    this.combatReady = true
    this.assetsReady = true
    this.setBootProgress(100, '准备就绪')
    // Remove the whole boot hint once ready.
    const boot = document.getElementById('boot-loading')
    if (boot) boot.remove()
    this.beginPlaySession()
    this.hud.toastMessage(
      this.playReport
        ? `Autotest 1/${this.playReport.sessionsTarget}`
        : '选择飞船 · 起飞挑战 20 关 Boss · 通关升级武器',
    )
  }

  private beginPlaySession() {
    if (!this.playReport || !this.autopilot) return
    if (this.playReport.sessionsCompleted >= this.playReport.sessionsTarget) return
    this.sessionIndex = this.playReport.sessionsCompleted + 1
    this.sessionTimer = 0
    this.sessionStartWall = performance.now()
    this.sessionDeaths = 0
    this.sessionKillsStart = this.combat.kills
    this.sessionScoreStart = this.combat.score
    this.wasDead = false
    this.autopilot.clearIssues()
    // Fresh campaign slice each autotest session
    this.combat.startLevel(1 + ((this.sessionIndex - 1) % 5))
    this.combat.resetSortiePower()
    this.combat.respawn()
    this.ship.velocity.set(0, 0, 0)
    this.ship.group.position.set(-380, 60, -220)
    // Face +Z toward station (Three.lookAt aims -Z; we need thrust axis)
    {
      const face = this.tmp.set(0, 40, 340).sub(this.ship.group.position).normalize()
      this.ship.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face)
      this.ship.group.rotation.setFromQuaternion(this.ship.group.quaternion)
    }
    this.mode = 'flight'
    this.clearTerrain()
    this.walker.setTerrain(null)
    this.ship.group.visible = true
  }

  private endPlaySession(reason: PlaySession['endReason']) {
    if (!this.playReport || !this.autopilot) return
    if (this.playReport.done) return
    const kills = this.combat.kills - this.sessionKillsStart
    const score = this.combat.score - this.sessionScoreStart
    const issues = [...this.autopilot.getIssues()]
    const pickups = this.combat.powerLevel
    // Flag only when there were enough kills for a drop and none collected
    if (kills >= 3 && pickups === 0) issues.push('missed_power_pickup')
    // Report real wall-clock duration (frame-rate independent).
    const durationSec = (performance.now() - this.sessionStartWall) / 1000
    const session: PlaySession = {
      index: this.sessionIndex,
      durationSec: Number(durationSec.toFixed(2)),
      kills,
      deaths: this.sessionDeaths,
      score,
      maxWave: this.combat.statusLine().wave,
      pickups,
      issues,
      endReason: reason,
    }
    this.playReport.sessions.push(session)
    this.playReport.sessionsCompleted += 1
    this.playReport.totalKills += kills
    this.playReport.totalDeaths += this.sessionDeaths
    for (const i of issues) {
      if (!this.playReport.uniqueIssues.includes(i)) this.playReport.uniqueIssues.push(i)
    }
    window.__PLAYTEST__ = this.playReport

    if (this.playReport.sessionsCompleted >= this.playReport.sessionsTarget) {
      this.playReport.done = true
      this.playReport.finishedAt = Date.now()
      this.hud.toastMessage(
        `Autotest done ${this.playReport.sessionsCompleted} · deaths ${this.playReport.totalDeaths} · issues ${this.playReport.uniqueIssues.length}`,
        12,
      )
      console.log('[PLAYTEST]', JSON.stringify(this.playReport, null, 2))
      return
    }
    this.beginPlaySession()
    this.hud.toastMessage(`Autotest ${this.playReport.sessionsCompleted + 1}/${this.playReport.sessionsTarget}`)
  }

  start() {
    this.renderer.setAnimationLoop(() => this.frame())
  }

  private frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05)
    this.input.beginFrame()
    this.world.update(dt)
    this.hud.update(dt)
    updateGodRaysPass(this.godRaysPass, this.camera, this.sunWorld)
    updateCinematicPass(this.cinematicPass, this.clock.elapsedTime)

    if (!this.running) {
      this.updateTitleCamera()
      this.composer.render()
      this.input.endFrame()
      return
    }

    if (this.ui.isPaused) {
      if (!this.pausedHint) {
        this.pausedHint = true
        this.hud.setPrompt('已暂停 · Esc 继续')
      }
      this.composer.render()
      this.input.endFrame()
      return
    }
    if (this.pausedHint) {
      this.pausedHint = false
      this.hud.setPrompt(null)
    }

    if (this.mode === 'flight') this.updateFlight(dt)
    else this.updateWalk(dt)

    this.composer.render()
    this.input.endFrame()
  }

  private updateTitleCamera(): void {
    const t = this.clock.elapsedTime
    // Showcase selected hangar hull
    this.ship.group.rotation.y = t * 0.35
    const orbit = 0.12 * t
    const radius = 28
    const height = 10 + Math.sin(t * 0.35) * 2

    this.camera.position.set(
      this.ship.group.position.x + Math.cos(orbit) * radius,
      this.ship.group.position.y + height,
      this.ship.group.position.z + Math.sin(orbit) * radius,
    )
    this.camera.lookAt(this.ship.group.position)
    this.camera.up.set(0, 1, 0)
  }

  private updateFlight(dt: number) {
    // Chapter-themed backdrop — swap once per level change
    if (this.bgThemeLevel !== this.combat.levelId) {
      this.bgThemeLevel = this.combat.levelId
      this.world.setEnvironment(environmentForLevel(this.combat.levelId), this.combat.levelId)
    }
    this.world.setParticleOrigin(this.ship.group.position)
    gameAudio.setCombat(this.combat.enemyList.some((e) => e.alive))
    if (this.playReport && this.autopilot && this.assetsReady && !this.playReport.done) {
      this.sessionTimer += dt
      this.autopilot.tick(dt, this.ship, this.combat, this.input.state)
      // Session ends: wall-clock timeout (frame-rate independent), or 2 deaths.
      if (performance.now() - this.sessionStartWall > this.autotestTimeout * 1000) {
        this.endPlaySession('timeout')
        return
      }
    }

    if (this.combat.playerHp <= 0) {
      if (!this.wasDead) {
        this.wasDead = true
        this.sessionDeaths += 1
      }
      this.hud.setPrompt('SHIP DESTROYED · press SPACE or R to relaunch')
      this.hud.setFlight(0, null, 'WRECK', this.cargo)
      this.hud.setCombat(this.combat.statusLine())
      this.ship.attachCamera(this.camera, dt)
      // Space (fire) or R (vertical up) to relaunch — no page refresh
      if (this.input.state.fire || this.input.state.vertical > 0) {
        this.combat.respawn()
        this.ship.velocity.set(0, 0, 0)
        this.ship.group.position.add(new THREE.Vector3(0, 40, -80))
        this.wasDead = false
        this.hud.toastMessage('Systems restored — 3s invulnerability')
        if (this.playReport && this.sessionDeaths >= 2) {
          this.endPlaySession('deaths')
        }
      }
      return
    }
    this.wasDead = false

    this.ship.update(dt, this.input.state)
    // Hard floor: never enter the sun (origin hazard)
    const sunR = this.ship.group.position.length()
    if (sunR < 95) {
      this.ship.group.position.setLength(95)
      const outward = this.tmp.copy(this.ship.group.position).normalize()
      if (this.ship.velocity.dot(outward) < 0) {
        this.ship.velocity.addScaledVector(outward, 40)
      }
    }
    this.ship.attachCamera(this.camera, dt)

    if (this.input.state.cycleWeapon) this.combat.cycleWeapon(1)
    if (this.input.state.weaponSlot != null) this.combat.selectWeapon(this.input.state.weaponSlot)
    if (this.input.state.cycleTarget) this.combat.cycleTarget(this.ship.group.position)

    if (this.combatReady) {
      this.combat.update(dt, this.ship.group, this.ship.velocity, {
        fire: this.input.state.fire,
        altFire: this.input.state.altFire,
        flying: true,
      })
    }

    // Sanity checks for playtest
    if (this.autopilot) {
      const spd = this.ship.speed()
      if (spd > 200) this.autopilot.note('speed_over_200')
      if (!Number.isFinite(spd)) this.autopilot.note('speed_nan')
      const st = this.combat.statusLine()
      if (st.hp < 0) this.autopilot.note('negative_hp')
    }

    const { body, altitude } = this.world.nearestBody(this.ship.group.position)
    const dockDist = this.ship.group.position.distanceTo(this.world.stationDockPoint())

    let prompt: string | null = 'SPACE fire · RMB/N missile · 1–6 weapons · Tab target'
    if (body && altitude < 35) prompt = `Near ${body.name} · press L to land`
    if (dockDist < 40) prompt = 'Station docking range · press G to dock'
    this.hud.setPrompt(prompt)

    if (this.input.state.land && body && altitude < 40) {
      this.enterSurface(body.id)
    }
    if (this.input.state.dock && dockDist < 45) {
      this.enterStation()
    }

    if (body && altitude < 2) {
      const push = this.tmp
        .copy(this.ship.group.position)
        .sub(body.position)
        .normalize()
      this.ship.group.position.copy(body.position).addScaledVector(push, body.radius + 3)
      this.ship.velocity.multiplyScalar(0.3)
    }

    const collected = this.world.tryCollect(this.ship.group.position, 8)
    if (collected) {
      this.cargo += collected.value
      this.hud.toastMessage(`Salvaged crystal +${collected.value}`)
    }

    this.hud.setFlight(this.ship.speed(), body ? altitude : null, 'FLIGHT', this.cargo)
    this.hud.setCombat(this.combat.statusLine())
    this.ship.group.visible = true
  }

  private updateWalk(dt: number) {
    if (this.mode === 'surface' && this.landedBodyId) {
      const body = this.world.bodies.find((b) => b.id === this.landedBodyId)
      if (body) {
        this.walker.gravityCenter.copy(body.position)
        // Keep terrain glued to moving planet
        if (this.terrain) {
          const up = this.tmp.copy(this.walker.position).sub(body.position).normalize()
          const surface = body.position.clone().addScaledVector(up, body.radius)
          if (this.terrain.root.children[0]) {
            this.terrain.root.children[0].position.copy(surface)
          }
        }
      }
    }

    this.walker.update(dt, this.input.state)
    this.walker.applyCamera(this.camera)
    this.ship.group.visible = false

    const collected = this.world.tryCollect(this.walker.position, 5)
    if (collected) {
      this.cargo += collected.value
      this.hud.toastMessage(`Collected crystal +${collected.value}`)
    }

    let prompt: string | null = 'Press X to return to ship'
    if (this.mode === 'station') {
      prompt = 'Helios Station · Press E to refine cargo · X to undock'
      if (this.input.state.interact && this.cargo > 0) {
        const credits = this.cargo * REFINE_RATE
        addHangarCredits(credits)
        this.hud.toastMessage(`精炼 ${this.cargo} 晶体 → 机库积分 +${credits}`)
        gameAudio.play('pickup')
        this.cargo = 0
      } else if (this.input.state.interact) {
        this.hud.toastMessage('Refinery idle — bring crystals from the planets')
      }
    }
    this.hud.setPrompt(prompt)

    if (this.input.state.exit) {
      this.returnToShip()
    }

    this.hud.setFlight(
      0,
      this.mode === 'surface' ? 0 : null,
      this.mode === 'station' ? 'STATION' : 'SURFACE',
      this.cargo,
    )
  }

  private enterSurface(bodyId: string) {
    const body = this.world.bodies.find((b) => b.id === bodyId)
    if (!body) return
    this.mode = 'surface'
    this.landedBodyId = bodyId
    this.input.setWalkMode(true)
    const dir = this.tmp.copy(this.ship.group.position).sub(body.position).normalize()
    this.walker.placeOnBody(body.position, body.radius, dir)
    this.ship.group.position.copy(body.position).addScaledVector(dir, body.radius + 18)
    this.ship.velocity.set(0, 0, 0)

    this.clearTerrain()
    const biome =
      bodyId === 'crya' ? 'icy' : bodyId === 'solara' ? 'desert' : bodyId === 'verdance' ? 'jungle' : bodyId
    this.terrain = new SurfaceTerrain()
    this.terrain.build({
      planetCenter: body.position.clone(),
      radius: body.radius,
      up: dir.clone(),
      biome,
      seed: bodyId.length * 97 + 11,
    })
    this.scene.add(this.terrain.root)
    this.walker.setTerrain(this.terrain)

    this.hud.toastMessage(`Landed on ${body.name} — terrain chunk active`)
  }

  private enterStation() {
    this.mode = 'station'
    this.landedBodyId = null
    this.clearTerrain()
    this.walker.setTerrain(null)
    this.input.setWalkMode(true)
    const dock = this.world.stationDockPoint()
    this.ship.group.position.copy(dock).add(new THREE.Vector3(0, 8, 12))
    this.ship.velocity.set(0, 0, 0)
    this.walker.surfaceRadius = 0
    this.walker.placeAt(dock.clone().add(new THREE.Vector3(0, 2, 0)), new THREE.Vector3(0, 1, 0))
    this.walker.gravityCenter.set(dock.x, dock.y - 50, dock.z)
    this.walker.surfaceRadius = 50
    this.hud.toastMessage('Docked at Helios Station')
  }

  private returnToShip() {
    this.mode = 'flight'
    this.landedBodyId = null
    this.clearTerrain()
    this.walker.setTerrain(null)
    this.input.setWalkMode(false)
    this.ship.group.visible = true
    this.hud.toastMessage('Systems online — flight mode')
  }

  private clearTerrain() {
    if (!this.terrain) return
    this.scene.remove(this.terrain.root)
    this.terrain.dispose()
    this.terrain = null
  }

  private onResize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
  }
}
