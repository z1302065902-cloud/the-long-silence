import * as THREE from 'three'
import type { CombatSystem } from './combat'
import type { InputState } from './input'
import type { Ship } from './ship'

/**
 * Deterministic-ish combat pilot for automated playtests.
 * Mutates InputState each frame (fire / thrust / look / weapon cycle).
 */
export class Autopilot {
  private t = 0
  private weaponTimer = 0
  private tmp = new THREE.Vector3()
  private fwd = new THREE.Vector3()
  private issues: string[] = []
  private lastHp = Infinity
  private stuckTimer = 0
  private lastPos = new THREE.Vector3()

  getIssues() {
    return this.issues
  }

  clearIssues() {
    this.issues = []
  }

  note(issue: string) {
    if (!this.issues.includes(issue)) this.issues.push(issue)
  }

  tick(dt: number, ship: Ship, combat: CombatSystem, state: InputState) {
    this.t += dt
    this.weaponTimer += dt

    // Reset axes then drive
    state.forward = 0
    state.strafe = 0
    state.vertical = 0
    state.roll = 0
    state.boost = false
    state.fire = false
    state.altFire = false
    state.lookX = 0
    state.lookY = 0
    state.cycleWeapon = false
    state.cycleTarget = false
    state.weaponSlot = null
    state.land = false
    state.dock = false
    state.exit = false
    state.interact = false

    if (combat.playerHp <= 0) {
      state.fire = true // Space relaunch
      this.note('death_event')
      this.lastHp = 100
      return
    }

    if (combat.playerHp < this.lastHp - 50) {
      this.note('heavy_burst_damage')
    }
    const tookHit = combat.playerHp < this.lastHp
    this.lastHp = combat.playerHp

    // Stuck detection
    if (ship.group.position.distanceToSquared(this.lastPos) < 0.05) {
      this.stuckTimer += dt
      if (this.stuckTimer > 4) this.note('ship_stuck_no_move')
    } else {
      this.stuckTimer = 0
      this.lastPos.copy(ship.group.position)
    }

    // Prefer pulse most of the time; light cycle for coverage
    if (this.weaponTimer > 10) {
      this.weaponTimer = 0
      state.weaponSlot = 0 // pulse — highest DPS for autopilot
    }

    const pickup = combat.getNearestPickup(ship.group.position)
    // Always chase active power pickups (spawned every 3 kills)
    if (pickup) {
      const pDist = ship.group.position.distanceTo(pickup.position)
      this.steerToward(ship, pickup.position, state)
      state.forward = pDist > 16 ? 0.7 : 0.15
      state.boost = pDist > 40
      state.strafe = Math.sin(this.t * 2) * 0.15
      state.fire = true
      return
    }

    // Stay away from sun (origin) — after pickups so we don't abandon drops
    const sunDist = ship.group.position.length()
    if (sunDist < 140) {
      if (sunDist < 70) this.note('too_close_to_sun')
      state.forward = 1
      state.boost = true
      state.strafe = 0
      this.steerToward(ship, this.tmp.copy(ship.group.position).normalize().multiplyScalar(320), state)
      return
    }

    const target = combat.getTarget()
    ship.group.getWorldDirection(this.fwd)

    if (!target) {
      state.forward = 0.35
      state.lookX = Math.sin(this.t * 0.7) * 0.03
      state.fire = this.t % 1 < 0.35
      return
    }

    // Overlap probe against all alive hostiles (scale-aware)
    for (const e of combat.enemyList) {
      if (!e.alive) continue
      const d = ship.group.position.distanceTo(e.group.position)
      const keep = (e.isBoss ? 34 : 18) + e.def.scale * 15
      if (d < keep * 0.5) this.note('enemy_overlap')
    }

    const aim = target.group.position.clone().addScaledVector(target.velocity, 0.35)
    this.steerToward(ship, aim, state)

    const to = aim.sub(ship.group.position)
    const dist = to.length()
    to.normalize()
    ship.group.getWorldDirection(this.fwd)
    const align = this.fwd.dot(to)
    const keep = (target.isBoss ? 32 : 18) + target.def.scale * 15
    const lowHp = combat.playerHp < combat.playerMaxHp * 0.42

    // Break off under fire / low HP instead of trading in knife-fight range
    if (lowHp || (tookHit && dist < keep * 2.2)) {
      state.forward = dist < keep * 1.8 ? -0.9 : 0.35
      state.boost = true
      state.strafe = Math.sin(this.t * 5.5) * 1
      state.vertical = Math.cos(this.t * 4.2) * 0.85
      if (dist < 280) state.fire = true
      if (dist < keep * 0.55) this.note('collision_near_enemy')
      return
    }

    // Only thrust when mostly pointed at the target — otherwise turn in place
    if (dist < keep * 1.35) {
      state.forward = -0.9
      state.boost = true
      state.strafe = Math.sin(this.t * 3.4) * 0.95
      state.vertical = Math.cos(this.t * 2.6) * 0.55
      if (dist < keep * 0.55) this.note('collision_near_enemy')
    } else if (align > 0.45) {
      state.forward = dist > 110 ? 1 : 0.5
      state.boost = dist > 150 && align > 0.65
      state.strafe = Math.sin(this.t * 2.2) * 0.45
      state.vertical = Math.cos(this.t * 1.4) * 0.28
    } else if (align > 0.1) {
      state.forward = 0.3
      state.boost = false
      state.strafe = Math.sin(this.t * 2.2) * 0.35
      state.vertical = Math.cos(this.t * 1.4) * 0.2
    } else {
      state.forward = 0
      state.boost = false
      state.strafe = Math.sin(this.t * 1.5) * 0.25
    }

    if (dist < 320) {
      state.fire = true
      if (align > 0.35 && dist > keep * 1.6 && dist < 220) state.altFire = true
    }

    if (!Number.isFinite(ship.group.position.x)) this.note('nan_position')
  }

  private steerToward(ship: Ship, worldPoint: THREE.Vector3, state: InputState) {
    ship.group.getWorldDirection(this.fwd)
    const desired = worldPoint.clone().sub(ship.group.position).normalize()
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(ship.group.quaternion)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(ship.group.quaternion)
    const yawErr = desired.dot(right)
    const pitchErr = -desired.dot(up)
    // Autopilot look is applied as angular-velocity deltas (same path as mouse)
    state.lookX = THREE.MathUtils.clamp(yawErr * 2.8, -2.2, 2.2)
    state.lookY = THREE.MathUtils.clamp(pitchErr * 2.8, -2.2, 2.2)
  }
}
