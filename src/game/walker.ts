import * as THREE from 'three'
import type { InputState } from './input'
import type { SurfaceTerrain } from './terrain'

export class Walker {
  readonly position = new THREE.Vector3()
  readonly yaw = { value: 0 }
  readonly pitch = { value: 0 }
  private velocity = new THREE.Vector3()
  private up = new THREE.Vector3(0, 1, 0)
  private forward = new THREE.Vector3()
  private right = new THREE.Vector3()
  private tmp = new THREE.Vector3()
  gravityCenter = new THREE.Vector3()
  surfaceRadius = 40
  eyeHeight = 2.2
  private terrain: SurfaceTerrain | null = null

  setTerrain(terrain: SurfaceTerrain | null) {
    this.terrain = terrain
  }

  placeOnBody(center: THREE.Vector3, radius: number, fromDir?: THREE.Vector3) {
    this.gravityCenter.copy(center)
    this.surfaceRadius = radius
    const dir = (fromDir ?? new THREE.Vector3(0, 1, 0)).clone().normalize()
    this.position.copy(center).addScaledVector(dir, radius + this.eyeHeight)
    this.up.copy(dir)
    this.yaw.value = 0
    this.pitch.value = 0
  }

  placeAt(pos: THREE.Vector3, up: THREE.Vector3) {
    this.position.copy(pos)
    this.up.copy(up).normalize()
    this.gravityCenter.copy(pos).sub(this.up.clone().multiplyScalar(this.eyeHeight))
    this.surfaceRadius = this.position.distanceTo(this.gravityCenter) - this.eyeHeight
  }

  update(dt: number, input: InputState) {
    this.yaw.value -= input.lookX
    this.pitch.value -= input.lookY
    this.pitch.value = THREE.MathUtils.clamp(this.pitch.value, -1.2, 1.2)

    this.forward.set(0, 0, -1).applyAxisAngle(this.up, this.yaw.value)
    this.right.crossVectors(this.forward, this.up).normalize()
    this.forward.crossVectors(this.up, this.right).normalize()

    this.tmp.set(0, 0, 0)
    this.tmp.addScaledVector(this.forward, input.forward)
    this.tmp.addScaledVector(this.right, input.strafe)
    if (this.tmp.lengthSq() > 0) this.tmp.normalize().multiplyScalar(input.boost ? 18 : 10)

    this.velocity.lerp(this.tmp, 1 - Math.pow(0.001, dt))
    this.position.addScaledVector(this.velocity, dt)

    const fromCenter = this.tmp.copy(this.position).sub(this.gravityCenter)
    this.up.copy(fromCenter).normalize()

    let ground = this.surfaceRadius
    if (this.terrain) {
      ground += this.terrain.sampleWorld(this.position)
    }
    this.position.copy(this.gravityCenter).addScaledVector(this.up, ground + this.eyeHeight)
  }

  applyCamera(camera: THREE.PerspectiveCamera) {
    camera.position.copy(this.position)
    const look = this.tmp
      .copy(this.forward)
      .applyAxisAngle(this.right, this.pitch.value)
      .multiplyScalar(10)
      .add(this.position)
    camera.up.copy(this.up)
    camera.lookAt(look)
  }
}
