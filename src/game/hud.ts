export class HUD {
  private speed = document.getElementById('speed')!
  private alt = document.getElementById('alt')!
  private mode = document.getElementById('mode')!
  private cargo = document.getElementById('cargo')!
  private prompt = document.getElementById('prompt')!
  private toast = document.getElementById('toast')!
  private title = document.getElementById('title-card')!
  private weapon = document.getElementById('weapon')!
  private hp = document.getElementById('hp')!
  private target = document.getElementById('target')!
  private level = document.getElementById('level')!
  private kills = document.getElementById('kills')!
  private chapter = document.getElementById('chapter')!
  private objectives = document.getElementById('objectives')!
  private hitVeil = document.getElementById('hit-veil')!
  private toastTimer = 0

  hideTitle() {
    this.title.classList.add('fade')
    window.setTimeout(() => this.title.classList.add('hidden'), 850)
  }

  setFlight(speed: number, altitude: number | null, mode: string, cargo: number) {
    this.speed.textContent = `SPD ${speed.toFixed(0).padStart(3, '0')}`
    this.alt.textContent = altitude == null ? 'ALT ——' : `ALT ${altitude.toFixed(0)}`
    this.mode.textContent = `MODE ${mode}`
    this.cargo.textContent = `CARGO ${cargo}`
  }

  setCombat(opts: {
    weapon: string
    hp: number
    shield: number
    kills: number
    score: number
    target: string
    wave: number
    level?: number
    chapter?: string
    brief?: string
    phase?: string
    bossHp?: string | null
    hitFlash: boolean
    power?: number
    objectives?: { label: string; done: boolean; detail: string }[]
  }) {
    this.weapon.textContent = `WPN ${opts.weapon}`
    this.hp.textContent = `HP ${Math.ceil(opts.hp)}  SH ${Math.ceil(opts.shield)}`
    this.target.textContent = `TGT ${opts.target}`
    const lv = opts.level ?? 1
    const phase = opts.phase ?? `W${opts.wave}`
    this.level.textContent = opts.bossHp
      ? `LV ${lv}  BOSS ${opts.bossHp}`
      : `LV ${lv}  ${phase}`
    const pow = opts.power ?? 0
    this.kills.textContent =
      pow > 0
        ? `KILLS ${opts.kills}  SCR ${opts.score}  PWR ×${pow}`
        : `KILLS ${opts.kills}  SCR ${opts.score}`
    if (opts.chapter) {
      this.chapter.textContent = opts.chapter
      this.chapter.title = opts.brief ?? ''
    }
    if (opts.objectives) {
      this.objectives.innerHTML = opts.objectives
        .map(
          (o) =>
            `<div class="obj${o.done ? ' done' : ''}">${o.label} <span>${o.detail}</span></div>`,
        )
        .join('')
    }
    this.hitVeil.classList.toggle('active', opts.hitFlash)
  }

  setPrompt(text: string | null) {
    if (!text) {
      this.prompt.classList.add('hidden')
      return
    }
    this.prompt.textContent = text
    this.prompt.classList.remove('hidden')
  }

  toastMessage(text: string, seconds = 2.5) {
    this.toast.textContent = text
    this.toast.classList.remove('hidden')
    this.toastTimer = seconds
  }

  update(dt: number) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt
      if (this.toastTimer <= 0) this.toast.classList.add('hidden')
    }
  }
}
