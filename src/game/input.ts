export interface InputState {
  forward: number
  strafe: number
  vertical: number
  roll: number
  boost: boolean
  jump: boolean
  sprint: boolean
  interact: boolean
  land: boolean
  dock: boolean
  exit: boolean
  fire: boolean
  altFire: boolean
  cycleWeapon: boolean
  cycleTarget: boolean
  weaponSlot: number | null
  pointerLocked: boolean
  lookX: number
  lookY: number
}

function createDefaultState(): InputState {
  return {
    forward: 0,
    strafe: 0,
    vertical: 0,
    roll: 0,
    boost: false,
    jump: false,
    sprint: false,
    interact: false,
    land: false,
    dock: false,
    exit: false,
    fire: false,
    altFire: false,
    cycleWeapon: false,
    cycleTarget: false,
    weaponSlot: null,
    pointerLocked: false,
    lookX: 0,
    lookY: 0,
  }
}

export class InputManager {
  private readonly element: HTMLElement
  private readonly keys = new Set<string>()
  private readonly edges = new Set<string>()
  private readonly state = createDefaultState()
  private pendingLookX = 0
  private pendingLookY = 0
  private readonly lookSensitivity = 0.0022
  private bound = false
  private mouseButtons = new Set<number>()

  constructor(element: HTMLElement) {
    this.element = element
  }

  attach(): void {
    if (this.bound) return
    this.bound = true
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
    this.element.addEventListener('click', this.requestPointerLock)
  }

  detach(): void {
    if (!this.bound) return
    this.bound = false
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)
    document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    this.element.removeEventListener('click', this.requestPointerLock)
    if (document.pointerLockElement === this.element) {
      document.exitPointerLock()
    }
  }

  requestPointerLock = (): void => {
    if (document.pointerLockElement !== this.element) {
      this.element.requestPointerLock()
    }
  }

  releasePointerLock = (): void => {
    if (document.pointerLockElement === this.element) {
      document.exitPointerLock()
    }
  }

  consumeFrameState(): InputState {
    this.syncMovementAxes()
    this.state.pointerLocked = document.pointerLockElement === this.element
    this.state.lookX = this.pendingLookX
    this.state.lookY = this.pendingLookY
    this.state.land = this.edges.has('KeyL')
    this.state.dock = this.edges.has('KeyG')
    this.state.interact = this.edges.has('KeyE')
    this.state.exit = this.edges.has('KeyX')
    this.state.fire =
      this.keys.has('Space') || this.mouseButtons.has(0) || this.keys.has('KeyV')
    this.state.altFire =
      this.mouseButtons.has(2) || this.keys.has('KeyB') || this.keys.has('KeyN')
    this.state.cycleWeapon = this.edges.has('KeyC')
    this.state.cycleTarget = this.edges.has('Tab')
    this.state.weaponSlot = null
    for (let i = 0; i < 5; i++) {
      if (this.edges.has(`Digit${i + 1}`)) this.state.weaponSlot = i
    }
    this.pendingLookX = 0
    this.pendingLookY = 0
    this.edges.clear()
    return { ...this.state }
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code)
  }

  private syncMovementAxes(): void {
    let forward = 0
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) forward += 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) forward -= 1

    let strafe = 0
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) strafe += 1
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) strafe -= 1

    // Space = fire (not thrust). Vertical: R up / F or Ctrl down.
    let vertical = 0
    if (this.keys.has('KeyR')) vertical += 1
    if (
      this.keys.has('KeyF') ||
      this.keys.has('ControlLeft') ||
      this.keys.has('ControlRight')
    ) {
      vertical -= 1
    }

    let roll = 0
    if (this.keys.has('KeyQ')) roll += 1
    if (this.keys.has('KeyE')) roll -= 1

    this.state.forward = forward
    this.state.strafe = strafe
    this.state.vertical = vertical
    this.state.roll = roll
    this.state.boost = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
    this.state.sprint = this.state.boost
    this.state.jump = this.keys.has('Space')
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return
    if (!this.keys.has(event.code)) {
      this.edges.add(event.code)
    }
    this.keys.add(event.code)
    if (event.code === 'Space' || event.code === 'Tab') {
      event.preventDefault()
    }
    this.syncMovementAxes()
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code)
    this.syncMovementAxes()
  }

  private onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.element) return
    this.pendingLookX += event.movementX * this.lookSensitivity
    this.pendingLookY += event.movementY * this.lookSensitivity
  }

  private onMouseDown = (event: MouseEvent): void => {
    this.mouseButtons.add(event.button)
    if (event.button === 2) event.preventDefault()
  }

  private onMouseUp = (event: MouseEvent): void => {
    this.mouseButtons.delete(event.button)
  }

  private onPointerLockChange = (): void => {
    this.state.pointerLocked = document.pointerLockElement === this.element
    if (!this.state.pointerLocked) {
      this.pendingLookX = 0
      this.pendingLookY = 0
      this.mouseButtons.clear()
    }
  }
}

export class Input {
  readonly state = createDefaultState()
  private readonly manager: InputManager

  constructor(element: HTMLElement) {
    this.manager = new InputManager(element)
    this.manager.attach()
  }

  beginFrame(): void {
    Object.assign(this.state, this.manager.consumeFrameState())
  }

  endFrame(): void {}

  dispose(): void {
    this.manager.detach()
  }
}
