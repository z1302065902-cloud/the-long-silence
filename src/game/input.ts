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
  /** Mouse position on screen, 0..1 (0.5 = center). Used when pointer is NOT locked. */
  mouseScreenX: number
  mouseScreenY: number
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
    mouseScreenX: 0.5,
    mouseScreenY: 0.5,
  }
}

export class InputManager {
  private readonly element: HTMLElement
  private readonly keys = new Set<string>()
  private readonly edges = new Set<string>()
  private readonly state = createDefaultState()
  private pendingLookX = 0
  private pendingLookY = 0
  private lookSensitivity = 0.0032
  private sensitivityMul = 1
  private walkMode = false
  // Mouse-position flight assist: when pointer is NOT locked, mouse screen position
  // steers the ship (like a twin-stick / casual flight model).
  private mouseScreenX = 0.5
  private mouseScreenY = 0.5
  private bound = false
  private mouseButtons = new Set<number>()

  // touch / mobile
  private joyEl: HTMLElement | null = null
  private fireEl: HTMLElement | null = null
  private altEl: HTMLElement | null = null
  private actEl: HTMLElement | null = null
  private exitEl: HTMLElement | null = null
  private readonly joyRadius = 60
  private touchJoyActive = false
  private joyTouchId = -1
  private joyBaseX = 0
  private joyBaseY = 0
  private joyX = 0
  private joyY = 0
  private touchFire = false
  private touchAlt = false
  private touchActEdge = false
  private touchExitEdge = false
  private lookTouchId = -1
  private lastLookX = 0
  private lastLookY = 0

  constructor(element: HTMLElement) {
    this.element = element
  }

  setSensitivityMul(mul: number): void {
    this.sensitivityMul = Math.max(0.4, Math.min(2.2, mul))
  }

  setWalkMode(on: boolean): void {
    this.walkMode = on
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
    // Touch never requests pointer lock — that would hijack the phone screen.
    this.element.addEventListener('click', this.onCanvasClick)

    // Touch controls (no-ops on desktop where the elements don't exist)
    this.joyEl = document.getElementById('touch-joy')
    this.fireEl = document.getElementById('touch-fire')
    this.altEl = document.getElementById('touch-alt')
    this.actEl = document.getElementById('touch-act')
    this.exitEl = document.getElementById('touch-exit')
    if (this.joyEl) {
      this.joyEl.addEventListener('touchstart', this.onJoyStart, { passive: false })
      this.joyEl.addEventListener('touchmove', this.onJoyMove, { passive: false })
      this.joyEl.addEventListener('touchend', this.onJoyEnd)
      this.joyEl.addEventListener('touchcancel', this.onJoyEnd)
    }
    for (const el of [this.fireEl, this.altEl, this.actEl, this.exitEl]) {
      if (el) {
        el.addEventListener('touchstart', this.onTouchBtnDown, { passive: false })
        el.addEventListener('touchend', this.onTouchBtnUp, { passive: false })
        el.addEventListener('touchcancel', this.onTouchBtnUp)
      }
    }
    // Canvas drag = look (only touches that aren't on controls land here).
    this.element.addEventListener('touchstart', this.onCanvasTouchStart, { passive: false })
    this.element.addEventListener('touchmove', this.onCanvasTouchMove, { passive: false })
    this.element.addEventListener('touchend', this.onCanvasTouchEnd)
    this.element.addEventListener('touchcancel', this.onCanvasTouchEnd)
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
    this.element.removeEventListener('click', this.onCanvasClick)
    if (this.joyEl) {
      this.joyEl.removeEventListener('touchstart', this.onJoyStart)
      this.joyEl.removeEventListener('touchmove', this.onJoyMove)
      this.joyEl.removeEventListener('touchend', this.onJoyEnd)
      this.joyEl.removeEventListener('touchcancel', this.onJoyEnd)
    }
    for (const el of [this.fireEl, this.altEl, this.actEl, this.exitEl]) {
      if (el) {
        el.removeEventListener('touchstart', this.onTouchBtnDown)
        el.removeEventListener('touchend', this.onTouchBtnUp)
        el.removeEventListener('touchcancel', this.onTouchBtnUp)
      }
    }
    this.element.removeEventListener('touchstart', this.onCanvasTouchStart)
    this.element.removeEventListener('touchmove', this.onCanvasTouchMove)
    this.element.removeEventListener('touchend', this.onCanvasTouchEnd)
    this.element.removeEventListener('touchcancel', this.onCanvasTouchEnd)
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
    this.state.mouseScreenX = this.mouseScreenX
    this.state.mouseScreenY = this.mouseScreenY
    this.state.land = this.edges.has('KeyL')
    this.state.dock = this.edges.has('KeyG')
    this.state.interact = this.walkMode && (this.edges.has('KeyE') || this.touchActEdge)
    this.state.exit = this.edges.has('KeyX') || this.touchExitEdge
    this.state.fire =
      this.keys.has('Space') ||
      this.mouseButtons.has(0) ||
      this.keys.has('KeyV') ||
      this.touchFire
    this.state.altFire =
      this.mouseButtons.has(2) ||
      this.keys.has('KeyB') ||
      this.keys.has('KeyN') ||
      this.touchAlt
    this.state.cycleWeapon = this.edges.has('KeyC')
    this.state.cycleTarget = this.edges.has('Tab')
    this.state.weaponSlot = null
    for (let i = 0; i < 6; i++) {
      if (this.edges.has(`Digit${i + 1}`)) this.state.weaponSlot = i
    }
    this.pendingLookX = 0
    this.pendingLookY = 0
    this.edges.clear()
    this.touchActEdge = false
    this.touchExitEdge = false
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
    // E double-binds to interact when on foot — only roll in flight.
    if (!this.walkMode) {
      if (this.keys.has('KeyQ')) roll += 1
      if (this.keys.has('KeyE')) roll -= 1
    }

    // Touch joystick overrides keyboard movement when active
    if (this.touchJoyActive) {
      forward = -this.joyY
      strafe = this.joyX
    }

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
    if (document.pointerLockElement === this.element) {
      this.pendingLookX += event.movementX * this.lookSensitivity * this.sensitivityMul
      this.pendingLookY += event.movementY * this.lookSensitivity * this.sensitivityMul
    } else {
      // Track screen-space mouse position for cursor-follow steering
      const rect = this.element.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        this.mouseScreenX = (event.clientX - rect.left) / rect.width
        this.mouseScreenY = (event.clientY - rect.top) / rect.height
      }
    }
  }

  private onCanvasClick = (event: MouseEvent): void => {
    // Touch taps must not grab pointer lock — that hijacks the phone screen.
    if ((event as PointerEvent).pointerType === 'touch') return
    this.requestPointerLock()
  }

  // ---- touch controls ----

  private setJoyKnob(dx: number, dy: number) {
    if (this.joyEl) {
      this.joyEl.style.setProperty('--jx', `${dx}px`)
      this.joyEl.style.setProperty('--jy', `${dy}px`)
    }
  }

  private onJoyStart = (e: TouchEvent): void => {
    if (this.touchJoyActive) return
    const t = e.changedTouches[0]
    if (!t) return
    this.touchJoyActive = true
    this.joyTouchId = t.identifier
    this.joyBaseX = t.clientX
    this.joyBaseY = t.clientY
    this.joyX = 0
    this.joyY = 0
    this.setJoyKnob(0, 0)
    e.preventDefault()
  }

  private onJoyMove = (e: TouchEvent): void => {
    if (!this.touchJoyActive) return
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      if (t.identifier !== this.joyTouchId) continue
      let dx = t.clientX - this.joyBaseX
      let dy = t.clientY - this.joyBaseY
      const len = Math.hypot(dx, dy)
      if (len > this.joyRadius) {
        dx = (dx / len) * this.joyRadius
        dy = (dy / len) * this.joyRadius
      }
      this.joyX = dx / this.joyRadius
      this.joyY = dy / this.joyRadius
      this.setJoyKnob(dx, dy)
      break
    }
    e.preventDefault()
  }

  private onJoyEnd = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.joyTouchId) {
        this.touchJoyActive = false
        this.joyTouchId = -1
        this.joyX = 0
        this.joyY = 0
        this.setJoyKnob(0, 0)
        break
      }
    }
  }

  private onTouchBtnDown = (e: TouchEvent): void => {
    const id = (e.currentTarget as HTMLElement).id
    if (id === 'touch-fire') this.touchFire = true
    else if (id === 'touch-alt') this.touchAlt = true
    else if (id === 'touch-act') this.touchActEdge = true
    else if (id === 'touch-exit') this.touchExitEdge = true
    e.preventDefault()
  }

  private onTouchBtnUp = (e: TouchEvent): void => {
    const id = (e.currentTarget as HTMLElement).id
    if (id === 'touch-fire') this.touchFire = false
    else if (id === 'touch-alt') this.touchAlt = false
    e.preventDefault()
  }

  private onCanvasTouchStart = (e: TouchEvent): void => {
    if (this.lookTouchId !== -1) return
    const t = e.changedTouches[0]
    if (!t) return
    this.lookTouchId = t.identifier
    this.lastLookX = t.clientX
    this.lastLookY = t.clientY
    e.preventDefault()
  }

  private onCanvasTouchMove = (e: TouchEvent): void => {
    if (this.lookTouchId === -1) return
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i]
      if (t.identifier !== this.lookTouchId) continue
      const dx = t.clientX - this.lastLookX
      const dy = t.clientY - this.lastLookY
      this.lastLookX = t.clientX
      this.lastLookY = t.clientY
      // One screen-width drag ≈ 180° turn; scales with the settings sensitivity.
      this.pendingLookX += dx * 0.006 * this.sensitivityMul
      this.pendingLookY += dy * 0.006 * this.sensitivityMul
      break
    }
    e.preventDefault()
  }

  private onCanvasTouchEnd = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.lookTouchId) {
        this.lookTouchId = -1
        break
      }
    }
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

  setSensitivityMul(mul: number): void {
    this.manager.setSensitivityMul(mul)
  }

  setWalkMode(on: boolean): void {
    this.manager.setWalkMode(on)
  }

  endFrame(): void {}

  dispose(): void {
    this.manager.detach()
  }
}
