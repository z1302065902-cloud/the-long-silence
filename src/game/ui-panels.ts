import { gameAudio } from './audio'
import { loadSettings, saveSettings, type GameSettings } from './settings'

type PanelHooks = {
  onPauseChange?: (paused: boolean) => void
  onSettingsChange?: (s: GameSettings) => void
  /** Tutorial "明白，起飞" → skip overlay AND launch immediately. */
  onTutorialLaunch?: () => void
}

/**
 * Tutorial overlay + Esc settings/pause panel.
 */
export class UiPanels {
  private settings: GameSettings
  private paused = false
  private hooks: PanelHooks
  private settingsEl: HTMLElement
  private tutorialEl: HTMLElement
  private privacyEl: HTMLElement
  private volInput: HTMLInputElement
  private sfxCheck: HTMLInputElement
  private sensInput: HTMLInputElement

  constructor(hooks: PanelHooks = {}) {
    this.hooks = hooks
    this.settings = loadSettings()
    this.settingsEl = document.getElementById('settings-panel')!
    this.tutorialEl = document.getElementById('tutorial-panel')!
    this.privacyEl = document.getElementById('privacy-panel')!
    this.volInput = document.getElementById('set-volume') as HTMLInputElement
    this.sfxCheck = document.getElementById('set-sfx') as HTMLInputElement
    this.sensInput = document.getElementById('set-sens') as HTMLInputElement

    this.applyAudio()
    this.bind()
    if (!this.settings.tutorialDone) this.showTutorial()
    else this.tutorialEl.classList.add('hidden')
  }

  get isPaused() {
    return this.paused
  }

  get current() {
    return this.settings
  }

  /** Autotest / skip overlays. */
  forceReady() {
    this.settings.tutorialDone = true
    saveSettings(this.settings)
    this.tutorialEl.classList.add('hidden')
    this.setPaused(false)
  }

  private bind() {
    this.volInput.value = String(Math.round(this.settings.masterVolume * 100))
    this.sfxCheck.checked = this.settings.sfxEnabled
    this.sensInput.value = String(this.settings.lookSensitivity)

    document.getElementById('settings-close')?.addEventListener('click', () => {
      gameAudio.play('ui')
      this.setPaused(false)
    })
    document.getElementById('tutorial-next')?.addEventListener('click', () => {
      gameAudio.resume()
      gameAudio.play('ui')
      this.dismissTutorial()
      this.hooks.onTutorialLaunch?.()
    })
    document.getElementById('btn-settings')?.addEventListener('click', () => {
      gameAudio.play('ui')
      this.setPaused(true)
    })
    document.getElementById('btn-privacy')?.addEventListener('click', () => {
      gameAudio.play('ui')
      this.settingsEl.classList.add('hidden')
      this.privacyEl.classList.remove('hidden')
    })
    document.getElementById('privacy-close')?.addEventListener('click', () => {
      gameAudio.play('ui')
      this.privacyEl.classList.add('hidden')
      this.settingsEl.classList.remove('hidden')
    })

    this.volInput.addEventListener('input', () => {
      this.settings.masterVolume = Number(this.volInput.value) / 100
      this.persist()
    })
    this.sfxCheck.addEventListener('change', () => {
      this.settings.sfxEnabled = this.sfxCheck.checked
      this.persist()
    })
    this.sensInput.addEventListener('input', () => {
      this.settings.lookSensitivity = Number(this.sensInput.value)
      this.persist()
    })

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        e.preventDefault()
        if (!this.tutorialEl.classList.contains('hidden')) return
        this.setPaused(!this.paused)
      }
    })
  }

  private showTutorial() {
    this.tutorialEl.classList.remove('hidden')
  }

  private dismissTutorial() {
    this.settings.tutorialDone = true
    saveSettings(this.settings)
    this.tutorialEl.classList.add('hidden')
  }

  private setPaused(on: boolean) {
    this.paused = on
    this.settingsEl.classList.toggle('hidden', !on)
    if (!on) this.privacyEl.classList.add('hidden')
    this.hooks.onPauseChange?.(on)
  }

  private persist() {
    saveSettings(this.settings)
    this.applyAudio()
    this.hooks.onSettingsChange?.(this.settings)
  }

  private applyAudio() {
    gameAudio.setEnabled(this.settings.sfxEnabled)
    gameAudio.setVolume(this.settings.masterVolume)
  }
}
