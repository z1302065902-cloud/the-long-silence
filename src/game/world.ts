import {
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  FogExp2,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  OctahedronGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Quaternion,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three'
import {
  createAtmosphereMaterial,
  createOuterHazeMaterial,
  setAtmosphereSun,
  updateAtmosphereTime,
} from './atmosphere.ts'
import {
  createCloudShellMaterial,
  createPlanetSurfaceMaterial,
  setSurfaceSun,
} from './planetSurface.ts'
import {
  createCloudTexture,
  createEnvironmentTexture,
  createEnvParticleTexture,
  createNebulaSpriteTexture,
  createPlanetTextures,
  createSeededRandom,
  createStarfieldTexture,
  ENV_PALETTES,
} from './procedural.ts'
import type { EnvId, EnvParticleType } from './procedural.ts'
import type { PlanetBiome } from './procedural.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CelestialBody {
  id: string
  name: string
  mesh: Mesh
  radius: number
  position: Vector3
  type: 'sun' | 'planet' | 'station' | 'asteroid'
  planetId?: string
  atmosphere?: Mesh
  orbitRadius: number
  orbitSpeed: number
  spin: number
  angle: number
}

export interface ResourceCrystal {
  mesh: Mesh
  collected: boolean
  planetId: string
  value: number
  id?: string
}

export interface LandingCandidate {
  planetId: string
  planetName: string
  position: Vector3
  normal: Vector3
  radius: number
}

interface PlanetConfig {
  id: string
  name: string
  biome: PlanetBiome
  seed: number
  radius: number
  orbitRadius: number
  orbitSpeed: number
  spinSpeed: number
  axialTilt: number
  atmosphereColor: number
  ring?: { inner: number; outer: number; opacity: number }
  crystalCount: number
  crystalValue: number
  startAngle: number
}

// ---------------------------------------------------------------------------
// SolarSystem
// ---------------------------------------------------------------------------

export class SolarSystem {
  readonly root = new Group()
  readonly scene: Scene
  readonly bodies: CelestialBody[] = []
  readonly crystals: ResourceCrystal[] = []
  readonly station: Group

  private readonly planetConfigs: PlanetConfig[] = [
    {
      id: 'crya',
      name: 'Crya',
      biome: 'icy',
      seed: 101,
      radius: 42,
      orbitRadius: 280,
      orbitSpeed: 0.035,
      spinSpeed: 0.12,
      axialTilt: 0.18,
      atmosphereColor: 0x4a9aaa,
      ring: { inner: 52, outer: 72, opacity: 0.14 },
      crystalCount: 8,
      crystalValue: 2,
      startAngle: 0.2,
    },
    {
      id: 'solara',
      name: 'Solara',
      biome: 'desert',
      seed: 202,
      radius: 50,
      orbitRadius: 420,
      orbitSpeed: 0.022,
      spinSpeed: 0.08,
      axialTilt: 0.32,
      atmosphereColor: 0xc4863c,
      crystalCount: 8,
      crystalValue: 2,
      startAngle: 2.1,
    },
    {
      id: 'verdance',
      name: 'Verdance',
      biome: 'jungle',
      seed: 303,
      radius: 46,
      orbitRadius: 560,
      orbitSpeed: 0.015,
      spinSpeed: 0.1,
      axialTilt: 0.12,
      atmosphereColor: 0x2a8868,
      crystalCount: 8,
      crystalValue: 3,
      startAngle: 4.0,
    },
  ]

  private planetGroups = new Map<string, Group>()
  private planetMeshes = new Map<string, Mesh>()
  private atmosphereMeshes = new Map<string, Mesh>()
  private atmosphereMaterials: ShaderMaterial[] = []
  private surfaceMaterials: ShaderMaterial[] = []
  private cloudMaterials: ShaderMaterial[] = []
  private sunWorld = new Vector3(0, 0, 0)
  private dockPoint = new Vector3()
  private elapsed = 0
  private starfieldMesh = new Mesh()
  private nebulaSprites: Sprite[] = []
  private envId: EnvId = 'space'
  private envSeed = 0
  private readonly themeSeed = 42
  private envLights!: {
    ambient: AmbientLight
    hemi: HemisphereLight
    rim: DirectionalLight
    key: DirectionalLight
  }
  private particleGroup = new Group()
  private particlePoints: Points | null = null
  private particleCfg: { type: EnvParticleType; HY: number; wrap: 'top' | 'bottom' | 'both'; sway: number } | null = null
  private particlePos = new Float32Array(0)
  private particleVel = new Float32Array(0)
  private particlePhase = new Float32Array(0)
  private asteroids!: InstancedMesh
  private sunGroup = new Group()

  constructor(scene: Scene, seed = 42) {
    this.scene = scene
    this.station = new Group()

    this.buildEnvironment()
    this.buildSun()
    this.buildPlanets()
    this.buildSpaceStation()
    this.asteroids = this.buildAsteroidField(seed)
    this.root.add(this.asteroids)

    this.scene.add(this.root)
  }

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  private buildEnvironment(): void {
    this.envLights = {
      ambient: new AmbientLight(0x3a5078, 1.15),
      hemi: new HemisphereLight(0xa8c8ea, 0x2a2030, 0.95),
      rim: new DirectionalLight(0xb5e0ff, 1.05),
      key: new DirectionalLight(0xfff0d8, 1.2),
    }
    this.envLights.rim.position.set(-200, 80, 120)
    this.envLights.key.position.set(180, 120, -60)
    this.root.add(this.envLights.ambient, this.envLights.hemi, this.envLights.rim, this.envLights.key)
    this.root.add(this.particleGroup)
    this.setEnvironment('space', 1)
  }

  /** Swap the deep-space backdrop per environment + level seed. */
  setEnvironment(id: EnvId, level: number): void {
    if (id === this.envId && level === this.envSeed) return
    this.envId = id
    this.envSeed = level
    const seed = this.themeSeed + level * 31
    this.buildSky(id, seed)
    this.applyEnvPalette(id)
    this.buildParticles(id, seed)
  }

  /** Keep ambient particles centered on the ship while flying. */
  setParticleOrigin(origin: Vector3): void {
    this.particleGroup.position.copy(origin)
  }

  private buildSky(id: EnvId, seed: number): void {
    // Dispose previous dome material/texture and drop it from the scene
    const oldMat = this.starfieldMesh.material as MeshBasicMaterial | undefined
    if (oldMat?.map) {
      oldMat.map.dispose()
      oldMat.dispose()
    }
    this.root.remove(this.starfieldMesh)
    this.starfieldMesh = new Mesh(
      new SphereGeometry(4000, 48, 32),
      new MeshBasicMaterial({
        map:
          id === 'space'
            ? createStarfieldTexture(2048, 1024, seed, 5800, 1)
            : createEnvironmentTexture(id, seed),
        side: BackSide,
        depthWrite: false,
        fog: false,
      }),
    )
    this.root.add(this.starfieldMesh)

    for (const s of this.nebulaSprites) {
      this.root.remove(s)
      const sm = s.material as SpriteMaterial
      sm.map?.dispose()
      sm.dispose()
    }
    this.nebulaSprites = []

    if (id === 'space') {
      const nebulaPositions = [
        new Vector3(-900, 320, -1200),
        new Vector3(700, -240, -1400),
        new Vector3(-400, -380, 900),
        new Vector3(1100, 180, -600),
        new Vector3(-200, 500, -800),
        new Vector3(600, 400, 1100),
        new Vector3(-800, -200, -1500),
        new Vector3(300, -500, 1300),
      ]
      const nebulaColors: number[] = [0x4a6cff, 0x8b3a8b, 0x2e8b57, 0xff6b35, 0x6a0dad, 0x1e90ff, 0xdc143c, 0x20b2aa]
      nebulaPositions.forEach((pos, i) => {
        const colorSeed = seed + i * 13 + i * 7
        const tex = createNebulaSpriteTexture(512, colorSeed, 1)
        // Use color from palette to tint sprite material color
        const mat = new SpriteMaterial({
          map: tex,
          color: nebulaColors[i % nebulaColors.length],
          blending: AdditiveBlending,
          transparent: true,
          depthWrite: false,
          opacity: 0.55 + (i % 3) * 0.12,
        })
        const sprite = new Sprite(mat)
        sprite.position.copy(pos)
        const s = 800 + i * 110
        sprite.scale.set(s, s, 1)
        sprite.renderOrder = -90
        this.root.add(sprite)
        this.nebulaSprites.push(sprite)
      })
    }

    // Asteroid belt — ring of small faceted rocks between inner planets
    this.buildAsteroidBelt(seed)
  }

  private applyEnvPalette(id: EnvId): void {
    const p = ENV_PALETTES[id]
    const fog = this.scene.fog as FogExp2 | null
    if (fog) {
      fog.color.setHex(p.fogColor)
      fog.density = p.fogDensity
    }
    const bg = this.scene.background as Color | null
    if (bg) bg.setHex(p.bgColor)
    this.envLights.ambient.color.setHex(p.ambientColor)
    this.envLights.ambient.intensity = p.ambient
    this.envLights.hemi.color.setHex(p.hemiSky)
    this.envLights.hemi.groundColor.setHex(p.hemiGround)
    this.envLights.hemi.intensity = p.hemi
    this.envLights.rim.color.setHex(p.rimColor)
    this.envLights.rim.intensity = p.rim
    this.envLights.key.color.setHex(p.keyColor)
    this.envLights.key.intensity = p.key
  }

  private buildParticles(id: EnvId, seed: number): void {
    if (this.particlePoints) {
      this.particleGroup.remove(this.particlePoints)
      const m = this.particlePoints.material as PointsMaterial
      m.map?.dispose()
      m.dispose()
      this.particlePoints.geometry.dispose()
      this.particlePoints = null
    }
    const pc = ENV_PALETTES[id].particle
    if (!pc) return

    const count = pc.count
    const rand = createSeededRandom(seed)
    const HX = 700
    const HY = 360
    const HZ = 700
    const pos = new Float32Array(count * 3)
    const vel = new Float32Array(count)
    const phase = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rand() - 0.5) * 2 * HX
      pos[i * 3 + 1] = (rand() - 0.5) * 2 * HY
      pos[i * 3 + 2] = (rand() - 0.5) * 2 * HZ
      vel[i] = pc.speed * (0.5 + rand())
      phase[i] = rand() * Math.PI * 2
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
    const mat = new PointsMaterial({
      size: pc.size,
      map: createEnvParticleTexture(pc.rgb, pc.type),
      color: 0xffffff,
      transparent: true,
      opacity: pc.opacity,
      depthWrite: false,
      sizeAttenuation: true,
      blending: pc.additive ? AdditiveBlending : NormalBlending,
    })
    this.particlePoints = new Points(geo, mat)
    this.particleGroup.add(this.particlePoints)
    this.particlePos = pos
    this.particleVel = vel
    this.particlePhase = phase
    this.particleCfg = { type: pc.type, HY, wrap: pc.wrap, sway: pc.sway }
  }

  private buildSun(): void {
    const coreGeo = new SphereGeometry(28, 64, 64)
    const coreMat = new MeshBasicMaterial({ color: 0xfff8e8 })
    const core = new Mesh(coreGeo, coreMat)
    this.sunGroup.add(core)

    const coronaCanvas = document.createElement('canvas')
    coronaCanvas.width = 256
    coronaCanvas.height = 256
    const ctx = coronaCanvas.getContext('2d')!
    const grad = ctx.createRadialGradient(128, 128, 16, 128, 128, 128)
    grad.addColorStop(0, 'rgba(255, 220, 140, 0.95)')
    grad.addColorStop(0.35, 'rgba(255, 160, 60, 0.45)')
    grad.addColorStop(0.65, 'rgba(220, 100, 40, 0.12)')
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 256)

    const coronaTex = new CanvasTexture(coronaCanvas)
    coronaTex.colorSpace = SRGBColorSpace
    const coronaMat = new SpriteMaterial({
      map: coronaTex,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    })
    const corona = new Sprite(coronaMat)
    corona.scale.set(160, 160, 1)
    this.sunGroup.add(corona)

    const outerCorona = new Sprite(
      new SpriteMaterial({
        map: coronaTex.clone(),
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0.35,
        color: 0xffaa66,
      }),
    )
    outerCorona.scale.set(220, 220, 1)
    this.sunGroup.add(outerCorona)

    const sunLight = new PointLight(0xffdd99, 6.5, 3200, 0.55)
    this.sunGroup.add(sunLight)

    const fillLight = new PointLight(0x66bbcc, 1.2, 1200, 1.8)
    fillLight.position.set(120, 60, -90)
    this.sunGroup.add(fillLight)

    this.root.add(this.sunGroup)

    this.bodies.push({
      id: 'sun',
      name: 'Sol Anchor',
      mesh: core,
      radius: 28,
      position: this.sunGroup.position,
      type: 'sun',
      orbitRadius: 0,
      orbitSpeed: 0,
      spin: 0.05,
      angle: 0,
    })
  }

  private buildPlanets(): void {
    for (const config of this.planetConfigs) {
      const group = new Group()
      group.userData.planetId = config.id

      const angle = config.startAngle
      group.position.set(
        Math.cos(angle) * config.orbitRadius,
        Math.sin(config.seed * 0.01) * 8,
        Math.sin(angle) * config.orbitRadius,
      )

      const textures = createPlanetTextures(config.biome, config.seed)
      const planetGeo = new SphereGeometry(config.radius, 96, 96)
      const planetMat = createPlanetSurfaceMaterial({
        map: textures.map,
        bumpMap: textures.bumpMap,
      })
      const planetMesh = new Mesh(planetGeo, planetMat)
      planetMesh.rotation.z = config.axialTilt
      planetMesh.castShadow = true
      planetMesh.receiveShadow = true
      group.add(planetMesh)
      this.planetMeshes.set(config.id, planetMesh)
      this.surfaceMaterials.push(planetMat)

      if (config.biome !== 'desert') {
        const cloudMat = createCloudShellMaterial(
          createCloudTexture(config.seed + 77),
          config.biome === 'icy' ? 0xddeeff : 0xffffff,
        )
        const clouds = new Mesh(new SphereGeometry(config.radius * 1.018, 64, 64), cloudMat)
        group.add(clouds)
        this.cloudMaterials.push(cloudMat)
      }

      const atmoGeo = new SphereGeometry(config.radius * 1.06, 64, 64)
      const atmoMat = createAtmosphereMaterial({
        color: config.atmosphereColor,
        intensity: config.biome === 'icy' ? 0.85 : 0.72,
        fresnelPower: 2.8,
        mieStrength: 0.65,
      })
      const atmoMesh = new Mesh(atmoGeo, atmoMat)
      group.add(atmoMesh)
      this.atmosphereMaterials.push(atmoMat)
      this.atmosphereMeshes.set(config.id, atmoMesh)

      const hazeGeo = new SphereGeometry(config.radius * 1.14, 48, 48)
      const hazeMat = createOuterHazeMaterial({ color: config.atmosphereColor })
      const hazeMesh = new Mesh(hazeGeo, hazeMat)
      group.add(hazeMesh)
      this.atmosphereMaterials.push(hazeMat)

      if (config.ring) {
        const ringGeo = new RingGeometry(config.ring.inner, config.ring.outer, 128)
        const ringMat = new MeshStandardMaterial({
          color: 0x668888,
          transparent: true,
          opacity: config.ring.opacity,
          side: DoubleSide,
          metalness: 0.2,
          roughness: 0.85,
          depthWrite: false,
        })
        const ring = new Mesh(ringGeo, ringMat)
        ring.rotation.x = Math.PI / 2 + 0.15
        group.add(ring)
      }

      const orbitRingGeo = new RingGeometry(config.orbitRadius - 0.6, config.orbitRadius + 0.6, 256)
      const orbitRingMat = new MeshBasicMaterial({
        color: 0x1a4a4a,
        transparent: true,
        opacity: 0.06,
        side: DoubleSide,
        depthWrite: false,
      })
      const orbitRing = new Mesh(orbitRingGeo, orbitRingMat)
      orbitRing.rotation.x = -Math.PI / 2
      this.root.add(orbitRing)

      this.spawnCrystals(config, group)

      this.planetGroups.set(config.id, group)
      this.root.add(group)

      this.bodies.push({
        id: config.id,
        name: config.name,
        mesh: planetMesh,
        radius: config.radius,
        position: group.position,
        type: 'planet',
        planetId: config.id,
        atmosphere: atmoMesh,
        orbitRadius: config.orbitRadius,
        orbitSpeed: config.orbitSpeed,
        spin: config.spinSpeed,
        angle: config.startAngle,
      })
    }
  }

  private spawnCrystals(config: PlanetConfig, planetGroup: Group): void {
    const rand = createSeededRandom(config.seed + 500)
    for (let i = 0; i < config.crystalCount; i++) {
      const phi = rand() * Math.PI * 2
      const theta = rand() * Math.PI
      const surfaceDist = config.radius + 1.6

      const localPos = new Vector3(
        surfaceDist * Math.sin(theta) * Math.cos(phi),
        surfaceDist * Math.cos(theta),
        surfaceDist * Math.sin(theta) * Math.sin(phi),
      )

      const crystalGeo = new OctahedronGeometry(1.2 + rand() * 0.6, 0)
      const crystalMat = new MeshStandardMaterial({
        color: 0x44ccaa,
        emissive: 0x228866,
        emissiveIntensity: 1.4,
        metalness: 0.6,
        roughness: 0.2,
        transparent: true,
        opacity: 0.92,
      })
      const crystal = new Mesh(crystalGeo, crystalMat)
      crystal.position.copy(localPos)
      crystal.scale.set(1, 1.4 + rand() * 0.4, 1)
      crystal.lookAt(localPos.clone().multiplyScalar(2))
      crystal.rotateX(Math.PI / 2)
      planetGroup.add(crystal)

      this.crystals.push({
        id: `${config.id}-${i}`,
        mesh: crystal,
        collected: false,
        planetId: config.id,
        value: config.crystalValue + Math.floor(rand() * 2),
      })
    }
  }

  private buildSpaceStation(): void {
    this.station.position.set(0, 40, 340)

    const frameMat = new MeshStandardMaterial({
      color: 0x2a3848,
      metalness: 0.85,
      roughness: 0.35,
    })
    const accentMat = new MeshStandardMaterial({
      color: 0x1a5858,
      metalness: 0.7,
      roughness: 0.4,
      emissive: 0x0a3030,
      emissiveIntensity: 0.4,
    })
    const lightMat = new MeshStandardMaterial({
      color: 0xffaa44,
      emissive: 0xff8833,
      emissiveIntensity: 2.5,
      metalness: 0.2,
      roughness: 0.5,
    })

    const hub = new Mesh(new CylinderGeometry(6, 6, 18, 20), frameMat)
    hub.rotation.x = Math.PI / 2
    this.station.add(hub)

    const ringRadii = [16, 22, 28]
    for (let i = 0; i < ringRadii.length; i++) {
      const torus = new Mesh(
        new TorusGeometry(ringRadii[i]!, 1 + i * 0.3, 10, 64),
        i === 1 ? accentMat : frameMat,
      )
      torus.rotation.x = Math.PI / 2
      torus.rotation.y = i * 0.3
      this.station.add(torus)
    }

    const modulePositions = [
      new Vector3(14, 0, 0),
      new Vector3(-14, 0, 0),
      new Vector3(0, 0, 14),
      new Vector3(0, 0, -14),
    ]
    for (const pos of modulePositions) {
      const mod = new Mesh(new BoxGeometry(4, 3, 4), accentMat)
      mod.position.copy(pos)
      mod.lookAt(0, 0, 0)
      this.station.add(mod)

      const window = new Mesh(new BoxGeometry(1.2, 1.2, 0.2), lightMat)
      window.position.copy(pos.clone().normalize().multiplyScalar(3).add(pos))
      this.station.add(window)
    }

    const dockPad = new Mesh(new CylinderGeometry(5, 5, 0.6, 24), frameMat)
    dockPad.position.set(0, -10, 0)
    dockPad.rotation.x = Math.PI / 2
    this.station.add(dockPad)

    for (const lp of [
      new Vector3(4, -10, 4),
      new Vector3(-4, -10, 4),
      new Vector3(4, -10, -4),
      new Vector3(-4, -10, -4),
    ]) {
      const light = new Mesh(new SphereGeometry(0.35, 8, 8), lightMat)
      light.position.copy(lp)
      this.station.add(light)
    }

    const beacon = new PointLight(0xffaa55, 1.5, 40, 2)
    beacon.position.set(0, -8, 0)
    this.station.add(beacon)

    this.root.add(this.station)

    const stationCollider = new Mesh(new SphereGeometry(32, 16, 16), frameMat)
    stationCollider.visible = false
    this.station.add(stationCollider)

    this.bodies.push({
      id: 'station-aurora',
      name: 'Helios Station',
      mesh: stationCollider,
      radius: 32,
      position: this.station.position,
      type: 'station',
      orbitRadius: 0,
      orbitSpeed: 0,
      spin: 0,
      angle: 0,
    })

    this.refreshDockPoint()
  }

  private buildAsteroidField(seed: number): InstancedMesh {
    const count = 220
    const geo = new OctahedronGeometry(1.2, 0)
    const mat = new MeshStandardMaterial({
      color: 0x3a4048,
      metalness: 0.15,
      roughness: 0.92,
      flatShading: true,
    })

    const instanced = new InstancedMesh(geo, mat, count)
    const rand = createSeededRandom(seed + 900)
    const matrix = new Matrix4()
    const pos = new Vector3()
    const scale = new Vector3()
    const quat = new Quaternion()
    const euler = new Euler()

    for (let i = 0; i < count; i++) {
      const band = 330 + rand() * 80
      const angle = rand() * Math.PI * 2
      const y = (rand() - 0.5) * 40
      pos.set(Math.cos(angle) * band, y, Math.sin(angle) * band)

      const s = 0.4 + rand() * 2.2
      scale.set(s, s * (0.7 + rand() * 0.6), s)

      euler.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI)
      quat.setFromEuler(euler)
      matrix.compose(pos, quat, scale)
      instanced.setMatrixAt(i, matrix)
    }
    instanced.instanceMatrix.needsUpdate = true

    this.bodies.push({
      id: 'asteroid-field',
      name: 'Kepler Belt',
      mesh: instanced as unknown as Mesh,
      radius: 55,
      position: new Vector3(0, 0, 0),
      type: 'asteroid',
      orbitRadius: 0,
      orbitSpeed: 0.01,
      spin: 0,
      angle: 0,
    })

    return instanced
  }

  private refreshDockPoint(): void {
    this.dockPoint.set(0, -12, 0)
    this.station.localToWorld(this.dockPoint)
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  update(dt: number): void {
    this.elapsed += dt

    const sunBody = this.bodies.find((b) => b.id === 'sun')
    if (sunBody) {
      sunBody.mesh.rotation.y += sunBody.spin * dt
    }

    for (const body of this.bodies) {
      if (body.type !== 'planet') continue

      body.angle += body.orbitSpeed * dt * 0.15
      const group = this.planetGroups.get(body.id)
      if (!group) continue

      group.position.set(
        Math.cos(body.angle) * body.orbitRadius,
        Math.sin(body.id.length * 0.7) * 8,
        Math.sin(body.angle) * body.orbitRadius,
      )
      body.position.copy(group.position)
      body.mesh.rotation.y += body.spin * dt

      const atmo = this.atmosphereMeshes.get(body.id)
      if (atmo) atmo.position.set(0, 0, 0)
    }

    this.sunWorld.set(0, 0, 0)
    for (const mat of this.atmosphereMaterials) {
      updateAtmosphereTime(mat, this.elapsed)
      setAtmosphereSun(mat, this.sunWorld)
    }
    for (const mat of this.surfaceMaterials) {
      setSurfaceSun(mat, this.sunWorld, this.elapsed)
    }
    for (const mat of this.cloudMaterials) {
      setSurfaceSun(mat, this.sunWorld, this.elapsed)
    }

    this.station.rotation.y += 0.08 * dt
    this.asteroids.rotation.y += 0.01 * dt
    this.refreshDockPoint()

    const stationBody = this.bodies.find((b) => b.id === 'station-aurora')
    if (stationBody) {
      stationBody.position.copy(this.station.position)
    }

    for (const crystal of this.crystals) {
      if (!crystal.collected) {
        crystal.mesh.rotation.y += dt * 1.5
      }
    }

    if (this.particlePoints && this.particleCfg) {
      const cfg = this.particleCfg
      const pos = this.particlePos
      const vel = this.particleVel
      const phase = this.particlePhase
      const attr = this.particlePoints.geometry.attributes.position as Float32BufferAttribute
      for (let i = 0, j = 0; i < pos.length; i += 3, j++) {
        pos[i + 1] += vel[j] * dt
        pos[i] += Math.sin(this.elapsed * 0.7 + phase[j]) * cfg.sway * dt
        pos[i + 2] += Math.cos(this.elapsed * 0.5 + phase[j] * 1.3) * cfg.sway * dt
        if (cfg.wrap === 'top' && pos[i + 1] > cfg.HY) {
          pos[i + 1] = -cfg.HY
        } else if (cfg.wrap === 'bottom' && pos[i + 1] < -cfg.HY) {
          pos[i + 1] = cfg.HY
        } else if (cfg.wrap === 'both') {
          if (pos[i + 1] > cfg.HY) pos[i + 1] = -cfg.HY
          else if (pos[i + 1] < -cfg.HY) pos[i + 1] = cfg.HY
        }
      }
      attr.needsUpdate = true
    }
  }

  // -------------------------------------------------------------------------
  // Query API
  // -------------------------------------------------------------------------

  getBodies(): CelestialBody[] {
    return this.bodies.map((b) => ({
      ...b,
      position: b.position.clone(),
    }))
  }

  getStationDockPoint(): Vector3 {
    return this.dockPoint.clone()
  }

  getLandingCandidates(): LandingCandidate[] {
    const candidates: LandingCandidate[] = []

    for (const config of this.planetConfigs) {
      const group = this.planetGroups.get(config.id)
      if (!group) continue

      const worldPos = new Vector3()
      group.getWorldPosition(worldPos)

      const approachDirs = [
        new Vector3(1, 0.2, 0).normalize(),
        new Vector3(-0.6, 0.3, 0.7).normalize(),
        new Vector3(0.2, -0.4, 0.9).normalize(),
      ]

      for (const dir of approachDirs) {
        const normal = dir.clone()
        const landingPos = worldPos.clone().add(normal.clone().multiplyScalar(config.radius + 0.5))
        candidates.push({
          planetId: config.id,
          planetName: config.name,
          position: landingPos,
          normal,
          radius: config.radius,
        })
      }
    }

    return candidates
  }

  collectCrystal(index: number): number {
    const crystal = this.crystals[index]
    if (!crystal || crystal.collected) return 0
    crystal.collected = true
    crystal.mesh.visible = false
    return crystal.value
  }

  // -------------------------------------------------------------------------
  // Game integration helpers
  // -------------------------------------------------------------------------

  nearestBody(pos: Vector3): { body: CelestialBody | null; altitude: number } {
    let best: CelestialBody | null = null
    let bestDist = Infinity
    for (const b of this.bodies) {
      if (b.type !== 'planet') continue
      const d = pos.distanceTo(b.position) - b.radius
      if (d < bestDist) {
        bestDist = d
        best = b
      }
    }
    return { body: best, altitude: bestDist }
  }

  stationDockPoint(): Vector3 {
    return this.getStationDockPoint()
  }

  tryCollect(pos: Vector3, radius = 6): ResourceCrystal | null {
    for (const c of this.crystals) {
      if (c.collected) continue
      const worldPos = new Vector3()
      c.mesh.getWorldPosition(worldPos)
      if (worldPos.distanceTo(pos) < radius) {
        c.collected = true
        c.mesh.visible = false
        return c
      }
    }
    return null
  }

  dispose(): void {
    this.root.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
      if (obj instanceof Sprite) {
        obj.material.dispose()
        obj.material.map?.dispose()
      }
    })
    this.scene.remove(this.root)
  }

  /** Asteroid belt: ~200 small faceted rocks orbiting between inner planets. */
  private asteroidBelt: InstancedMesh | null = null

  private buildAsteroidBelt(seed: number): void {
    if (this.asteroidBelt) {
      this.root.remove(this.asteroidBelt)
      this.asteroidBelt.geometry.dispose()
      ;(this.asteroidBelt.material as MeshStandardMaterial).dispose()
    }

    const count = 220
    const innerRadius = 160
    const outerRadius = 240
    const geo = new OctahedronGeometry(1.2, 0)
    const mat = new MeshStandardMaterial({
      color: 0x8899aa,
      metalness: 0.5,
      roughness: 0.6,
    })

    const rng = createSeededRandom(seed + 999)
    this.asteroidBelt = new InstancedMesh(geo, mat, count)
    const m = new Matrix4()
    const q = new Quaternion()
    const s = new Vector3()

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rng() * 0.3
      const radius = innerRadius + rng() * (outerRadius - innerRadius)
      const height = (rng() - 0.5) * 18
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const y = height

      const size = 0.4 + rng() * 1.6
      s.set(size, size * (0.5 + rng() * 0.5), size * (0.7 + rng() * 0.3))
      q.setFromEuler(new Euler(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI))
      m.compose(new Vector3(x, y, z), q, s)
      this.asteroidBelt!.setMatrixAt(i, m)
    }
    this.asteroidBelt.instanceMatrix.needsUpdate = true
    this.asteroidBelt.castShadow = true
    this.asteroidBelt.receiveShadow = true
    this.root.add(this.asteroidBelt)
  }
}

/** Backward-compatible alias for existing game code. */
export { SolarSystem as World }
