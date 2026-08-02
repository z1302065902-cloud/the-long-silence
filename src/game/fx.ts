import * as THREE from 'three'

type Burst = {
  life: number
  maxLife: number
  light: THREE.PointLight
  flash: THREE.Mesh
  sparks: THREE.Points
  velocities: Float32Array
  active: boolean
  kind: 'hit' | 'boom'
}

const SPARK_HIT = 10
const SPARK_BOOM = 18
const MAX_BURSTS = 5

/**
 * Cheap hit sparks + small death booms. Hard-capped pool to avoid FPS death.
 */
export class FxSystem {
  readonly root = new THREE.Group()
  private bursts: Burst[] = []
  private tmp = new THREE.Vector3()
  private hitCooldown = 0

  spawnExplosion(pos: THREE.Vector3, opts?: { scale?: number; color?: number; big?: boolean }) {
    const scale = Math.min(opts?.scale ?? 1, 1.6)
    const color = opts?.color ?? 0xff8844
    const big = Boolean(opts?.big)
    const b = this.acquire()
    b.active = true
    b.kind = 'boom'
    b.maxLife = big ? 0.4 : 0.28
    b.life = b.maxLife
    b.light.color.setHex(color)
    b.light.intensity = big ? 2.2 : 1.2
    b.light.distance = 18 * scale
    b.light.visible = true
    ;(b.flash.material as THREE.MeshBasicMaterial).color.setHex(color)
    ;(b.flash.material as THREE.MeshBasicMaterial).opacity = 0.55
    ;(b.sparks.material as THREE.PointsMaterial).color.setHex(0xffeeaa)
    ;(b.sparks.material as THREE.PointsMaterial).size = 0.22
    ;(b.sparks.material as THREE.PointsMaterial).opacity = 0.85

    b.flash.position.copy(pos)
    b.sparks.position.copy(pos)
    b.light.position.copy(pos)
    b.flash.scale.setScalar(0.25 * scale)
    b.flash.visible = true
    b.sparks.visible = true

    this.resetSparks(b, SPARK_BOOM, (big ? 14 : 9) * scale)
  }

  /** Tiny impact only — no expanding sphere (that was causing the purple fog ball). */
  spawnHitSpark(pos: THREE.Vector3, color = 0xffcc66) {
    if (this.hitCooldown > 0) return
    this.hitCooldown = 0.05
    const b = this.acquire()
    b.active = true
    b.kind = 'hit'
    b.maxLife = 0.16
    b.life = b.maxLife
    b.light.visible = false
    b.flash.visible = false
    ;(b.sparks.material as THREE.PointsMaterial).color.setHex(color)
    ;(b.sparks.material as THREE.PointsMaterial).size = 0.16
    ;(b.sparks.material as THREE.PointsMaterial).opacity = 0.8
    b.sparks.position.copy(pos)
    b.sparks.visible = true
    this.resetSparks(b, SPARK_HIT, 6)
  }

  update(dt: number) {
    if (this.hitCooldown > 0) this.hitCooldown -= dt
    for (const b of this.bursts) {
      if (!b.active) continue
      b.life -= dt
      const t = 1 - Math.max(0, b.life) / b.maxLife
      const fade = 1 - t

      if (b.kind === 'boom' && b.flash.visible) {
        b.flash.scale.setScalar(0.25 + t * 1.4)
        ;(b.flash.material as THREE.MeshBasicMaterial).opacity = 0.5 * fade * fade
        b.light.intensity = (b.maxLife > 0.35 ? 2.2 : 1.2) * fade
      }

      const count = b.kind === 'hit' ? SPARK_HIT : SPARK_BOOM
      const posAttr = b.sparks.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < count; i++) {
        posAttr.array[i * 3] += b.velocities[i * 3] * dt
        posAttr.array[i * 3 + 1] += b.velocities[i * 3 + 1] * dt
        posAttr.array[i * 3 + 2] += b.velocities[i * 3 + 2] * dt
        b.velocities[i * 3] *= 1 - 3 * dt
        b.velocities[i * 3 + 1] *= 1 - 3 * dt
        b.velocities[i * 3 + 2] *= 1 - 3 * dt
      }
      posAttr.needsUpdate = true
      ;(b.sparks.material as THREE.PointsMaterial).opacity = 0.85 * fade

      if (b.life <= 0) {
        b.active = false
        b.flash.visible = false
        b.sparks.visible = false
        b.light.visible = false
      }
    }
  }

  private acquire(): Burst {
    let b = this.bursts.find((x) => !x.active)
    if (b) return b
    if (this.bursts.length < MAX_BURSTS) {
      b = this.createBurst()
      this.bursts.push(b)
      return b
    }
    // Steal oldest
    b = this.bursts[0]!
    for (const x of this.bursts) {
      if (x.life < b!.life) b = x
    }
    return b!
  }

  private resetSparks(b: Burst, count: number, speed: number) {
    const posAttr = b.sparks.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < SPARK_BOOM; i++) {
      if (i < count) {
        posAttr.setXYZ(i, 0, 0, 0)
        const spd = speed * (0.45 + Math.random() * 0.7)
        const dir = this.tmp
          .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
          .normalize()
        b.velocities[i * 3] = dir.x * spd
        b.velocities[i * 3 + 1] = dir.y * spd
        b.velocities[i * 3 + 2] = dir.z * spd
      } else {
        posAttr.setXYZ(i, 0, 0, 0)
        b.velocities[i * 3] = 0
        b.velocities[i * 3 + 1] = 0
        b.velocities[i * 3 + 2] = 0
      }
    }
    posAttr.needsUpdate = true
  }

  private createBurst(): Burst {
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xff8844,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), flashMat)
    flash.visible = false

    const positions = new Float32Array(SPARK_BOOM * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const sparkMat = new THREE.PointsMaterial({
      color: 0xffeeaa,
      size: 0.18,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    const sparks = new THREE.Points(geo, sparkMat)
    sparks.visible = false

    const light = new THREE.PointLight(0xff8844, 0, 16, 2)
    light.visible = false

    this.root.add(flash, sparks, light)
    return {
      life: 0,
      maxLife: 0.3,
      light,
      flash,
      sparks,
      velocities: new Float32Array(SPARK_BOOM * 3),
      active: false,
      kind: 'hit',
    }
  }
}
