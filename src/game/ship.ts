import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Camera,
  type PerspectiveCamera,
} from 'three'
import type { InputState } from './input.ts'

export type { InputState }

const THRUST_ACCEL = 28
const STRAFE_ACCEL = 18
const VERTICAL_ACCEL = 16
const BOOST_MULTIPLIER = 2.4
const LINEAR_DAMPING = 2.8
const ANGULAR_DAMPING = 4.5
const ROLL_ACCEL = 2.2
const MAX_LINEAR_SPEED = 90
const MAX_ANGULAR_SPEED = 2.4
const EXHAUST_PARTICLE_COUNT = 28

const hullMaterial = new MeshPhysicalMaterial({
  color: 0x8a9bb4,
  metalness: 0.78,
  roughness: 0.22,
  clearcoat: 0.85,
  clearcoatRoughness: 0.12,
})

const accentMaterial = new MeshStandardMaterial({
  color: 0x3f9cff,
  metalness: 0.88,
  roughness: 0.14,
  emissive: 0x1a4a88,
  emissiveIntensity: 0.55,
})

const glassMaterial = new MeshPhysicalMaterial({
  color: 0xb8e4ff,
  metalness: 0.05,
  roughness: 0.04,
  transmission: 0.88,
  thickness: 0.35,
  transparent: true,
  opacity: 0.82,
  ior: 1.45,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
  side: DoubleSide,
})

const engineMaterial = new MeshStandardMaterial({
  color: 0x2a3040,
  metalness: 0.92,
  roughness: 0.28,
  emissive: 0xff6622,
  emissiveIntensity: 1.8,
})

const antennaMaterial = new MeshStandardMaterial({
  color: 0xd8dee9,
  metalness: 0.95,
  roughness: 0.2,
})

type ExhaustSystem = {
  points: Points
  positions: Float32Array
  velocities: Float32Array
  lifetimes: Float32Array
}

function createExhaustSystem(): ExhaustSystem {
  const positions = new Float32Array(EXHAUST_PARTICLE_COUNT * 3)
  const velocities = new Float32Array(EXHAUST_PARTICLE_COUNT * 3)
  const lifetimes = new Float32Array(EXHAUST_PARTICLE_COUNT)

  for (let i = 0; i < EXHAUST_PARTICLE_COUNT; i += 1) {
    lifetimes[i] = Math.random()
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))

  const material = new PointsMaterial({
    color: 0xff8a3d,
    size: 0.11,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: AdditiveBlending,
    sizeAttenuation: true,
  })

  return {
    points: new Points(geometry, material),
    positions,
    velocities,
    lifetimes,
  }
}

export function createSpacecraft(): Group {
  const ship = new Group()
  ship.name = 'spacecraft'

  const fuselage = new Mesh(new BoxGeometry(1.1, 0.55, 4.2), hullMaterial)
  fuselage.castShadow = true
  fuselage.receiveShadow = true
  ship.add(fuselage)

  const nose = new Mesh(new ConeGeometry(0.55, 1.4, 8), accentMaterial)
  nose.rotation.x = Math.PI / 2
  nose.position.z = -2.75
  nose.castShadow = true
  ship.add(nose)

  const spine = new Mesh(new BoxGeometry(0.35, 0.22, 3.2), accentMaterial)
  spine.position.y = 0.18
  spine.position.z = 0.15
  ship.add(spine)

  const wingGeometry = new BoxGeometry(2.8, 0.08, 1.35)
  const leftWing = new Mesh(wingGeometry, hullMaterial)
  leftWing.position.set(-1.45, -0.08, 0.55)
  leftWing.rotation.z = 0.12
  leftWing.castShadow = true
  ship.add(leftWing)

  const rightWing = new Mesh(wingGeometry, hullMaterial)
  rightWing.position.set(1.45, -0.08, 0.55)
  rightWing.rotation.z = -0.12
  rightWing.castShadow = true
  ship.add(rightWing)

  const topStabilizer = new Mesh(new BoxGeometry(1.6, 0.06, 0.55), accentMaterial)
  topStabilizer.position.set(0, 0.42, 1.55)
  ship.add(topStabilizer)

  const cockpitFrame = new Mesh(new TorusGeometry(0.42, 0.08, 10, 24), hullMaterial)
  cockpitFrame.rotation.x = Math.PI / 2
  cockpitFrame.position.set(0, 0.18, -0.85)
  ship.add(cockpitFrame)

  const cockpitGlass = new Mesh(
    new SphereGeometry(0.38, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
    glassMaterial,
  )
  cockpitGlass.position.set(0, 0.24, -0.95)
  ship.add(cockpitGlass)

  const enginePositions = [
    new Vector3(-0.42, -0.08, 2.05),
    new Vector3(0.42, -0.08, 2.05),
    new Vector3(0, -0.22, 2.2),
  ]

  for (const position of enginePositions) {
    const bell = new Mesh(new CylinderGeometry(0.24, 0.34, 0.55, 12, 1, true), engineMaterial)
    bell.rotation.x = Math.PI / 2
    bell.position.copy(position)
    ship.add(bell)

    const innerGlow = new Mesh(new CylinderGeometry(0.12, 0.18, 0.2, 10), engineMaterial)
    innerGlow.rotation.x = Math.PI / 2
    innerGlow.position.copy(position).add(new Vector3(0, 0, 0.28))
    ship.add(innerGlow)
  }

  const antennaPole = new Mesh(new CylinderGeometry(0.025, 0.025, 0.85, 8), antennaMaterial)
  antennaPole.position.set(0.08, 0.62, -0.35)
  ship.add(antennaPole)

  const antennaTip = new Mesh(new SphereGeometry(0.06, 10, 10), accentMaterial)
  antennaTip.position.set(0.08, 1.05, -0.35)
  ship.add(antennaTip)

  return ship
}

export class FlightController {
  readonly mesh: Group
  readonly velocity = new Vector3()
  readonly angularVelocity = new Vector3()
  readonly thrust = new Vector3()

  private readonly exhaustLeft: ExhaustSystem
  private readonly exhaustRight: ExhaustSystem
  private readonly exhaustCenter: ExhaustSystem
  private readonly cameraOffset = new Vector3(0, 1.35, 3.8)
  private readonly cameraLookOffset = new Vector3(0, 0.35, -2.5)
  private readonly worldPosition = new Vector3()
  private readonly worldQuaternion = new Quaternion()
  private readonly forward = new Vector3()
  private readonly right = new Vector3()
  private readonly up = new Vector3()
  private readonly tempForce = new Vector3()
  private readonly cameraPosition = new Vector3()
  private readonly cameraTarget = new Vector3()
  private attachedCamera: Camera | null = null
  private thrustIntensity = 0
  private speedMul = 1

  constructor(mesh?: Group) {
    this.mesh = mesh ?? createSpacecraft()

    // Twin thin plumes, spawned behind the hull; chase cam sits high so they don't cover it
    this.exhaustLeft = createExhaustSystem()
    this.exhaustRight = createExhaustSystem()
    this.exhaustCenter = createExhaustSystem()
    this.exhaustCenter.points.visible = false

    // +Z = forward. Exhaust aft = -Z. High chase cam looks over the plume.
    const kenney = Boolean(mesh?.userData?.kenney)
    if (kenney) {
      this.exhaustLeft.points.position.set(-0.5, -0.35, -5.6)
      this.exhaustRight.points.position.set(0.5, -0.35, -5.6)
      this.cameraOffset.set(0, 5.8, -15)
      this.cameraLookOffset.set(0, 0.2, 6)
    } else {
      this.exhaustLeft.points.position.set(-0.35, -0.15, -2.4)
      this.exhaustRight.points.position.set(0.35, -0.15, -2.4)
      this.cameraOffset.set(0, 2.2, -4.2)
      this.cameraLookOffset.set(0, 0.2, 2.2)
    }

    this.mesh.add(this.exhaustLeft.points, this.exhaustRight.points)
  }

  update(dt: number, input: InputState): void {
    const clampedDt = Math.min(dt, 0.05)
    this.applyRotation(clampedDt, input)
    this.applyTranslation(clampedDt, input)
    this.integrateMotion(clampedDt)
    this.updateExhaust(clampedDt)
    this.updateCamera(clampedDt)
  }

  getPosition(): Vector3 {
    return this.mesh.getWorldPosition(this.worldPosition.clone())
  }

  getQuaternion(): Quaternion {
    return this.mesh.getWorldQuaternion(this.worldQuaternion.clone())
  }

  attachCamera(camera: Camera, dt = 0.016): void {
    this.attachedCamera = camera
    this.updateCamera(dt)
  }

  detachCamera(): void {
    this.attachedCamera = null
  }

  getThrustIntensity(): number {
    return this.thrustIntensity
  }

  setSpeedMul(mul: number): void {
    this.speedMul = Math.max(0.5, Math.min(1.4, mul))
  }

  private applyRotation(dt: number, input: InputState): void {
    // Apply look whenever deltas exist (pointer-lock mice OR autopilot).
    // Mouse look only accumulates under pointer lock; autopilot writes look directly.
    const hasLook = Math.abs(input.lookX) > 1e-6 || Math.abs(input.lookY) > 1e-6
    if (hasLook) {
      this.angularVelocity.y -= input.lookX
      this.angularVelocity.x -= input.lookY
    }

    if (input.roll !== 0) {
      this.angularVelocity.z += input.roll * ROLL_ACCEL * dt
    }

    const hasRotationInput = hasLook || input.roll !== 0

    if (!hasRotationInput) {
      this.angularVelocity.multiplyScalar(Math.max(0, 1 - ANGULAR_DAMPING * dt))
    }

    this.angularVelocity.x = clamp(this.angularVelocity.x, -MAX_ANGULAR_SPEED, MAX_ANGULAR_SPEED)
    this.angularVelocity.y = clamp(this.angularVelocity.y, -MAX_ANGULAR_SPEED, MAX_ANGULAR_SPEED)
    this.angularVelocity.z = clamp(this.angularVelocity.z, -MAX_ANGULAR_SPEED, MAX_ANGULAR_SPEED)

    this.mesh.rotation.x += this.angularVelocity.x * dt
    this.mesh.rotation.y += this.angularVelocity.y * dt
    this.mesh.rotation.z += this.angularVelocity.z * dt
  }

  private applyTranslation(dt: number, input: InputState): void {
    this.mesh.getWorldDirection(this.forward)
    this.right.crossVectors(this.forward, this.mesh.up).normalize()
    this.up.copy(this.mesh.up).normalize()

    const boost = input.boost ? BOOST_MULTIPLIER : 1
    this.tempForce.set(0, 0, 0)

    if (input.forward > 0) {
      this.tempForce.addScaledVector(this.forward, input.forward * THRUST_ACCEL * boost)
    } else if (input.forward < 0) {
      this.tempForce.addScaledVector(this.forward, input.forward * THRUST_ACCEL * 0.55)
    }

    // Mouse-position steering (casual / cursor-follow mode).
    // When pointer is NOT locked, mouse screen position directly drives
    // strafe + vertical — like a classic arcade top-down / rail shooter.
    // Center (0.5, 0.5) = neutral; edges = full lateral thrust.
    let strafeInput = input.strafe
    let verticalInput = input.vertical
    if (!input.pointerLocked) {
      const dx = (input.mouseScreenX - 0.5) * 2 // -1..1
      const dy = (0.5 - input.mouseScreenY) * 2 // -1..1 (up = positive)
      // Dead zone in the center so tiny jitters don't cause drift
      const dz = 0.08
      const sx = Math.abs(dx) < dz ? 0 : (Math.sign(dx) * (Math.abs(dx) - dz) / (1 - dz))
      const sy = Math.abs(dy) < dz ? 0 : (Math.sign(dy) * (Math.abs(dy) - dz) / (1 - dz))
      // Mix with keyboard — whichever has larger magnitude wins per axis
      strafeInput = Math.max(-1, Math.min(1, strafeInput + sx * 1.2))
      verticalInput = Math.max(-1, Math.min(1, verticalInput + sy * 1.2))
    }

    if (strafeInput !== 0) {
      this.tempForce.addScaledVector(this.right, strafeInput * STRAFE_ACCEL * boost)
    }
    if (verticalInput !== 0) {
      this.tempForce.addScaledVector(this.up, verticalInput * VERTICAL_ACCEL * boost)
    }

    this.thrust.copy(this.tempForce)

    const hasTranslationInput =
      input.forward !== 0 || strafeInput !== 0 || verticalInput !== 0

    if (hasTranslationInput) {
      this.velocity.addScaledVector(this.tempForce, dt)
    } else {
      this.velocity.multiplyScalar(Math.max(0, 1 - LINEAR_DAMPING * dt))
    }

    const maxSpd = MAX_LINEAR_SPEED * this.speedMul
    if (this.velocity.length() > maxSpd) {
      this.velocity.setLength(maxSpd)
    }

    this.thrustIntensity = clamp(
      this.tempForce.length() / (THRUST_ACCEL * BOOST_MULTIPLIER),
      0,
      1,
    )
  }

  private integrateMotion(dt: number): void {
    this.mesh.position.addScaledVector(this.velocity, dt)
  }

  private updateExhaust(dt: number): void {
    // Twin symmetric plumes — both thrusters stay visible for a clean silhouette.
    const spawnRate = (16 + this.thrustIntensity * 40) * 0.6
    updateParticleSystem(
      this.exhaustLeft,
      dt,
      spawnRate,
      this.thrustIntensity,
      this.mesh.quaternion,
    )
    updateParticleSystem(
      this.exhaustRight,
      dt,
      spawnRate,
      this.thrustIntensity,
      this.mesh.quaternion,
    )
    const hotColor = new Color(0xff8a3d)
    const coolColor = new Color(0x4cc9ff)
    for (const points of [this.exhaustLeft.points, this.exhaustRight.points]) {
      const material = points.material as PointsMaterial
      material.color.copy(hotColor).lerp(coolColor, 1 - this.thrustIntensity)
      material.size = 0.07 + this.thrustIntensity * 0.07
      material.opacity = 0.28 + this.thrustIntensity * 0.3
    }
  }

  private updateCamera(dt: number): void {
    if (!this.attachedCamera) return

    const offset = this.cameraOffset.clone().applyQuaternion(this.mesh.quaternion)
    const lookTarget = this.cameraLookOffset.clone().applyQuaternion(this.mesh.quaternion)

    this.cameraPosition.copy(this.mesh.position).add(offset)
    this.cameraTarget.copy(this.mesh.position).add(lookTarget)

    const camera = this.attachedCamera as PerspectiveCamera
    if (typeof camera.position.lerp === 'function' && dt > 0) {
      camera.position.lerp(this.cameraPosition, 1 - Math.pow(0.0008, dt))
    } else {
      camera.position.copy(this.cameraPosition)
    }

    camera.up.set(0, 1, 0)
    camera.lookAt(this.cameraTarget)
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function updateParticleSystem(
  system: ExhaustSystem,
  dt: number,
  spawnRate: number,
  intensity: number,
  shipRotation: Quaternion,
): void {
  const { positions, velocities, lifetimes, points } = system
  let spawnsRemaining = Math.floor(spawnRate * dt)

  for (let i = 0; i < EXHAUST_PARTICLE_COUNT; i += 1) {
    lifetimes[i] -= dt * (1.8 + intensity * 2.0)
    if (lifetimes[i] > 0) {
      positions[i * 3] += velocities[i * 3] * dt
      positions[i * 3 + 1] += velocities[i * 3 + 1] * dt
      positions[i * 3 + 2] += velocities[i * 3 + 2] * dt
      continue
    }

    if (spawnsRemaining <= 0) continue
    spawnsRemaining -= 1

    lifetimes[i] = 0.16 + Math.random() * 0.22
    positions[i * 3] = (Math.random() - 0.5) * 0.08
    positions[i * 3 + 1] = (Math.random() - 0.5) * 0.08
    positions[i * 3 + 2] = Math.random() * 0.05

    // Spray aft (−Z); +Z is ship forward
    const speed = 5 + intensity * 14 + Math.random() * 3
    const local = new Vector3(
      (Math.random() - 0.5) * 1.4,
      (Math.random() - 0.5) * 1.4,
      -speed,
    ).applyQuaternion(shipRotation)

    velocities[i * 3] = local.x
    velocities[i * 3 + 1] = local.y
    velocities[i * 3 + 2] = local.z
  }

  const attribute = points.geometry.getAttribute('position') as BufferAttribute
  attribute.needsUpdate = true
}

export class Ship {
  readonly controller: FlightController

  constructor(mesh?: Group) {
    this.controller = new FlightController(mesh)
  }

  get group(): Group {
    return this.controller.mesh
  }

  get velocity(): Vector3 {
    return this.controller.velocity
  }

  update(dt: number, input: InputState): void {
    this.controller.update(dt, input)
  }

  attachCamera(camera: PerspectiveCamera, dt: number): void {
    this.controller.attachCamera(camera, dt)
  }

  speed(): number {
    return this.controller.velocity.length()
  }

  setSpeedMul(mul: number): void {
    this.controller.setSpeedMul(mul)
  }
}
