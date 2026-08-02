import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { ShipDef } from './ships'

const loader = new GLTFLoader()

function loadGlb(url: string, timeoutMs = 15000): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    let done = false
    const timer = window.setTimeout(() => {
      if (done) return
      done = true
      reject(new Error(`Craft load timeout: ${url}`))
    }, timeoutMs)
    loader.load(
      url,
      (gltf) => {
        if (done) return
        done = true
        window.clearTimeout(timer)
        resolve(gltf.scene)
      },
      undefined,
      (err) => {
        if (done) return
        done = true
        window.clearTimeout(timer)
        reject(err)
      },
    )
  })
}

/**
 * Realistic hull shading: keep albedo maps, moderate metal, enough fill so
 * ships read as solid craft instead of bloomed silhouettes.
 */
function hardenMaterials(root: THREE.Object3D, opts?: { preserveColor?: boolean }) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial
      if (!mat || !('color' in mat)) continue

      // Mild lift only — avoid blowing out to white edges
      mat.color.offsetHSL(0, 0.01, 0.04)
      if ('metalness' in mat) mat.metalness = THREE.MathUtils.clamp(mat.metalness ?? 0.45, 0.25, 0.65)
      if ('roughness' in mat) mat.roughness = THREE.MathUtils.clamp(mat.roughness ?? 0.45, 0.28, 0.62)
      if ('envMapIntensity' in mat) mat.envMapIntensity = 0.95

      if (!opts?.preserveColor) {
        mat.emissive = new THREE.Color(0x0c141c)
        mat.emissiveIntensity = 0.08
      } else {
        // Subtle cabin/panel glow without silhouette bloom
        if (!mat.emissive || mat.emissive.getHex() === 0) {
          mat.emissive = new THREE.Color(0x101820)
        } else {
          mat.emissive.multiplyScalar(0.35)
        }
        mat.emissiveIntensity = Math.min(mat.emissiveIntensity ?? 0.15, 0.18)
      }

      const phys = mat as THREE.MeshPhysicalMaterial
      if ('clearcoat' in phys) {
        phys.clearcoat = 0.25
        phys.clearcoatRoughness = 0.35
      }
      mat.needsUpdate = true
    }
  })
}

function centerAndFit(model: THREE.Object3D, targetLength = 10): THREE.Group {
  const wrap = new THREE.Group()
  wrap.add(model)

  const box = new THREE.Box3().setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  model.position.x -= center.x
  model.position.y -= center.y
  model.position.z -= center.z

  const longest = Math.max(size.x, size.y, size.z, 0.001)
  wrap.scale.setScalar(targetLength / longest)
  return wrap
}

export type CraftPaint = {
  tint?: number
  emissive?: number
  emissiveIntensity?: number
  scale?: number
  keepTexture?: boolean
  /** Skip thruster meshes (use for enemy fleet to save draw calls) */
  noThrusters?: boolean
}

function applyPaint(root: THREE.Object3D, paint?: CraftPaint) {
  if (!paint || paint.keepTexture) return
  if (paint.tint == null && paint.emissive == null) return
  const tint = paint.tint != null ? new THREE.Color(paint.tint) : null
  const emissive = paint.emissive != null ? new THREE.Color(paint.emissive) : null
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial
      if (!mat || !('color' in mat)) continue
      if (tint) mat.color.lerp(tint, 0.45)
      if (emissive) {
        mat.emissive = emissive.clone().multiplyScalar(0.25)
        mat.emissiveIntensity = Math.min(paint.emissiveIntensity ?? 0.2, 0.22)
      }
      mat.needsUpdate = true
    }
  })
}

/** Compact thruster nozzles at the stern — readable glow without a fog wall. */
function addThrusterNozzles(root: THREE.Group, color = 0x66ffe8) {
  const glow = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const offsets = [
    [-0.55, -0.15, -5.4],
    [0.55, -0.15, -5.4],
    [0, -0.35, -5.55],
  ] as const
  for (const [x, y, z] of offsets) {
    const nozzle = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), glow.clone())
    nozzle.position.set(x, y, z)
    nozzle.scale.set(1, 1, 1.6)
    root.add(nozzle)
  }
  // Skip per-ship PointLight — dozens of lights kill FPS with many enemies
}

export async function loadCraftFile(
  pack: 'quaternius' | 'kenney',
  name: string,
  paint?: CraftPaint,
): Promise<THREE.Group> {
  const primary = pack === 'quaternius' ? `assets/quaternius/${name}` : `assets/kenney/${name}`
  const fallbacks =
    pack === 'quaternius'
      ? [`assets/quaternius/Bob.glb`, `assets/kenney/craft_speederA.glb`]
      : [`assets/kenney/craft_speederA.glb`]

  let model: THREE.Group | null = null
  for (const url of [primary, ...fallbacks]) {
    try {
      model = await loadGlb(url)
      break
    } catch {
      /* try next */
    }
  }
  if (!model) throw new Error(`Failed to load craft ${name}`)

  hardenMaterials(model, { preserveColor: Boolean(paint?.keepTexture) })
  applyPaint(model, paint)
  const hull = centerAndFit(model, 12)
  if (paint?.scale && paint.scale !== 1) hull.scale.multiplyScalar(paint.scale)

  const root = new THREE.Group()
  root.add(hull)
  if (!paint?.noThrusters) addThrusterNozzles(root, paint?.emissive ?? 0x66ffe8)
  root.userData.kenney = true
  root.userData.pack = pack
  return root
}

/** Kenney Space Kit (CC0) */
export async function loadKenneyCraft(
  name = 'craft_speederA.glb',
  paint?: CraftPaint,
): Promise<THREE.Group> {
  return loadCraftFile('kenney', name, paint)
}

export async function loadShipHull(def: ShipDef): Promise<THREE.Group> {
  return loadCraftFile(def.pack, def.craft, {
    tint: def.tint,
    emissive: def.emissive,
    emissiveIntensity: def.emissiveIntensity,
    scale: def.scale,
    keepTexture: def.keepTexture,
  })
}

export async function decorateStationWithKenney(station: THREE.Group): Promise<void> {
  const [hangar, hangarRound, dish, rocket, platform, fuel, cargo] = await Promise.all([
    loadGlb('assets/kenney/hangar_largeA.glb'),
    loadGlb('assets/kenney/hangar_roundA.glb'),
    loadGlb('assets/kenney/satelliteDish.glb'),
    loadGlb('assets/kenney/rocket_baseA.glb'),
    loadGlb('assets/kenney/platform_large.glb'),
    loadGlb('assets/kenney/rocket_fuelA.glb'),
    loadGlb('assets/kenney/craft_cargoA.glb'),
  ])

  const place = (obj: THREE.Object3D, pos: THREE.Vector3, scale: number, rotY = 0) => {
    hardenMaterials(obj)
    const g = obj.clone(true)
    g.position.copy(pos)
    g.scale.setScalar(scale)
    g.rotation.y = rotY
    station.add(g)
  }

  place(platform, new THREE.Vector3(0, -10.2, 0), 4.5, 0)
  place(hangar, new THREE.Vector3(18, -6, 8), 2.2, -0.6)
  place(hangarRound, new THREE.Vector3(-16, -5.5, -10), 2.4, 1.1)
  place(dish, new THREE.Vector3(8, 10, -14), 2.8, 0.4)
  place(rocket, new THREE.Vector3(-10, -4, 16), 2.0, 0.2)
  place(fuel, new THREE.Vector3(12, -7, -6), 2.2, -0.3)

  hardenMaterials(cargo)
  cargo.scale.setScalar(2.4)
  cargo.position.set(6, -8.5, 4)
  cargo.rotation.y = 0.8
  station.add(cargo)
}

/** Soft space reflection — bright enough for panels, not silhouette bloom. */
export function installSpaceEnv(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envScene = new THREE.Scene()
  envScene.add(new THREE.AmbientLight(0xffffff, 0.65))
  const hemi = new THREE.HemisphereLight(0xc8e0ff, 0x3a2818, 1.0)
  envScene.add(hemi)
  const sun = new THREE.DirectionalLight(0xfff2dc, 1.6)
  sun.position.set(5, 3, 2)
  envScene.add(sun)
  const fill = new THREE.DirectionalLight(0x9ec8ff, 0.55)
  fill.position.set(-4, 2, -3)
  envScene.add(fill)
  const envMap = pmrem.fromScene(envScene, 0.04).texture
  scene.environment = envMap
  if ('environmentIntensity' in scene) {
    ;(scene as THREE.Scene & { environmentIntensity: number }).environmentIntensity = 0.9
  }
  pmrem.dispose()
}
