import * as THREE from 'three'
import { fbm2D } from './procedural'

export type TerrainBiome = 'icy' | 'desert' | 'jungle' | string

/**
 * Local heightfield chunk placed at the landing site (not a whole-planet mesh).
 * Walker samples this for foot height so the surface reads as terrain, not a perfect sphere.
 */
export class SurfaceTerrain {
  readonly root = new THREE.Group()
  private mesh: THREE.Mesh | null = null
  private heights!: Float32Array
  private segs = 96
  private halfExtent = 55
  private up = new THREE.Vector3(0, 1, 0)
  private center = new THREE.Vector3()
  private radius = 40
  private basis = new THREE.Matrix4()
  private invBasis = new THREE.Matrix4()
  private tmp = new THREE.Vector3()
  private tmp2 = new THREE.Vector3()
  private quat = new THREE.Quaternion()

  build(opts: {
    planetCenter: THREE.Vector3
    radius: number
    up: THREE.Vector3
    biome: TerrainBiome
    seed: number
  }) {
    this.dispose()
    this.center.copy(opts.planetCenter)
    this.radius = opts.radius
    this.up.copy(opts.up).normalize()

    this.quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.up)
    this.basis.makeRotationFromQuaternion(this.quat)
    this.invBasis.copy(this.basis).invert()

    const segs = this.segs
    const geo = new THREE.PlaneGeometry(this.halfExtent * 2, this.halfExtent * 2, segs, segs)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position as THREE.BufferAttribute
    this.heights = new Float32Array((segs + 1) * (segs + 1))

    const amp =
      opts.biome === 'desert' ? 4.2 : opts.biome === 'icy' ? 5.5 : opts.biome === 'jungle' ? 3.8 : 4

    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i)
      const lz = pos.getZ(i)
      const u = (lx / this.halfExtent) * 0.5 + 0.5
      const v = (lz / this.halfExtent) * 0.5 + 0.5
      const h =
        fbm2D(u * 4.5, v * 4.5, opts.seed, 5) * amp +
        fbm2D(u * 14, v * 14, opts.seed + 3, 3) * amp * 0.35
      // flatten near center landing pad
      const dist = Math.hypot(lx, lz)
      const pad = THREE.MathUtils.smoothstep(8, 22, dist)
      const height = h * pad
      this.heights[i] = height
      pos.setY(i, height)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()

    const color =
      opts.biome === 'icy'
        ? 0xb8d4e8
        : opts.biome === 'desert'
          ? 0xc4a06a
          : opts.biome === 'jungle'
            ? 0x3d7a4a
            : 0x8899aa

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.92,
      metalness: 0.04,
      flatShading: false,
    })

    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.mesh.quaternion.copy(this.quat)

    const surfacePoint = this.tmp.copy(this.center).addScaledVector(this.up, this.radius)
    this.mesh.position.copy(surfacePoint)

    // subtle rock accents
    const rockGeo = new THREE.DodecahedronGeometry(1.2, 0)
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a554c, roughness: 0.95 })
    for (let i = 0; i < 28; i++) {
      const rx = (Math.random() - 0.5) * this.halfExtent * 1.6
      const rz = (Math.random() - 0.5) * this.halfExtent * 1.6
      if (Math.hypot(rx, rz) < 10) continue
      const rock = new THREE.Mesh(rockGeo, rockMat)
      const hy = this.sampleLocal(rx, rz)
      rock.position.set(rx, hy + 0.4, rz)
      rock.scale.setScalar(0.6 + Math.random() * 1.8)
      rock.rotation.set(Math.random(), Math.random(), Math.random())
      this.mesh.add(rock)
    }

    this.root.add(this.mesh)
  }

  /** Height above mean sphere surface at a world position. */
  sampleWorld(worldPos: THREE.Vector3): number {
    if (!this.mesh) return 0
    const local = this.tmp2.copy(worldPos).sub(this.mesh.position)
    local.applyMatrix4(this.invBasis)
    return this.sampleLocal(local.x, local.z)
  }

  sampleLocal(x: number, z: number): number {
    const segs = this.segs
    const u = (x / this.halfExtent) * 0.5 + 0.5
    const v = (z / this.halfExtent) * 0.5 + 0.5
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0

    const fx = u * segs
    const fz = v * segs
    const x0 = Math.floor(fx)
    const z0 = Math.floor(fz)
    const x1 = Math.min(x0 + 1, segs)
    const z1 = Math.min(z0 + 1, segs)
    const tx = fx - x0
    const tz = fz - z0

    const h00 = this.heights[z0 * (segs + 1) + x0]
    const h10 = this.heights[z0 * (segs + 1) + x1]
    const h01 = this.heights[z1 * (segs + 1) + x0]
    const h11 = this.heights[z1 * (segs + 1) + x1]
    const h0 = h00 + (h10 - h00) * tx
    const h1 = h01 + (h11 - h01) * tx
    return h0 + (h1 - h0) * tz
  }

  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose()
      const m = this.mesh.material
      if (Array.isArray(m)) m.forEach((x) => x.dispose())
      else m.dispose()
      this.root.remove(this.mesh)
      this.mesh = null
    }
    while (this.root.children.length) this.root.remove(this.root.children[0])
  }
}
