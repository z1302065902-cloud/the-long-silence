export type GameSettings = {
  masterVolume: number
  sfxEnabled: boolean
  lookSensitivity: number
  tutorialDone: boolean
  showFps: boolean
}

const KEY = 'tls-settings-v1'

const DEFAULTS: GameSettings = {
  masterVolume: 0.55,
  sfxEnabled: true,
  lookSensitivity: 1,
  tutorialDone: false,
  showFps: false,
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const p = JSON.parse(raw) as Partial<GameSettings>
    return {
      masterVolume: clamp(Number(p.masterVolume ?? DEFAULTS.masterVolume), 0, 1),
      sfxEnabled: p.sfxEnabled !== false,
      lookSensitivity: clamp(Number(p.lookSensitivity ?? 1), 0.4, 2.2),
      tutorialDone: Boolean(p.tutorialDone),
      showFps: Boolean(p.showFps),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(s: GameSettings) {
  localStorage.setItem(KEY, JSON.stringify(s))
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v))
}
