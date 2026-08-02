/**
 * Web Audio synth engine — layered SFX + procedural ambient music.
 * No downloads needed; everything synthesized at runtime.
 */

type SfxKind = 'fire' | 'hit' | 'boom' | 'pickup' | 'ui' | 'damage' | 'clear'

// A-minor space progression: Am — F — C — G (2 bars each)
const CHORDS: number[][] = [
  [110, 164.81, 220, 261.63],
  [87.31, 130.81, 174.61, 220],
  [130.81, 196, 261.63, 329.63],
  [98, 146.83, 196, 246.94],
]
const BPM = 68
const BAR = (60 / BPM) * 4
const CHORD_DUR = BAR * 2

type ToneOpts = {
  freq: number
  endFreq?: number
  dur: number
  gain: number
  type?: OscillatorType
  attack?: number
  release?: number
  filter?: number
  filterEnd?: number
  pan?: number
  delay?: number
}

export class GameAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private enabled = true
  private volume = 0.55
  private lastFire = 0

  // music state
  private musicStarted = false
  private nextChordTime = 0
  private chordIndex = 0
  private combat = false
  private useSynth = false
  private bgmEl: HTMLAudioElement | null = null
  private bgmReady = false
  private bgmFailed = false

  get isEnabled() {
    return this.enabled
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (this.master) this.master.gain.value = on ? this.volume : 0
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.master && this.enabled) this.master.gain.value = this.volume
  }

  /** Faster / brighter music when fighting. */
  setCombat(on: boolean) {
    if (this.combat === on) return
    this.combat = on
    if (this.musicGain && this.ctx) {
      const target = on ? 1.15 : 0.85
      this.musicGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 1.5)
    }
  }

  /** Call from first user gesture / launch. */
  resume() {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctx()
      const comp = this.ctx.createDynamicsCompressor()
      comp.threshold.value = -18
      comp.knee.value = 22
      comp.ratio.value = 4
      comp.attack.value = 0.004
      comp.release.value = 0.18
      comp.connect(this.ctx.destination)

      this.master = this.ctx.createGain()
      this.master.gain.value = this.enabled ? this.volume : 0
      this.master.connect(comp)

      this.musicGain = this.ctx.createGain()
      this.musicGain.gain.value = 0.85
      this.musicGain.connect(this.master)

      this.sfxGain = this.ctx.createGain()
      this.sfxGain.gain.value = 1
      this.sfxGain.connect(this.master)

      const len = Math.floor(this.ctx.sampleRate * 0.5)
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const data = this.noiseBuf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    }
    void this.ctx.resume()
    this.startMusic()
  }

  play(kind: SfxKind) {
    if (!this.enabled) return
    this.resume()
    if (!this.ctx || !this.sfxGain) return
    const t = this.ctx.currentTime
    switch (kind) {
      case 'fire':
        if (t - this.lastFire < 0.045) return
        this.lastFire = t
        {
          const f = 900 + Math.random() * 140
          this.tone({
            freq: f,
            endFreq: f * 0.5,
            dur: 0.07,
            gain: 0.045,
            type: 'square',
            attack: 0.002,
            release: 0.05,
            filter: 3200,
            filterEnd: 900,
            pan: Math.random() * 0.3 - 0.15,
          })
          this.noise(0.03, 0.02, 4000, 'highpass')
        }
        break
      case 'hit':
        this.tone({
          freq: 1500 + Math.random() * 500,
          dur: 0.05,
          gain: 0.06,
          type: 'triangle',
          attack: 0.002,
          release: 0.04,
          filter: 5000,
          pan: Math.random() * 0.5 - 0.25,
        })
        this.noise(0.045, 0.045, 2600, 'highpass')
        break
      case 'boom':
        this.tone({ freq: 150, endFreq: 38, dur: 0.42, gain: 0.5, type: 'sine', attack: 0.004, release: 0.38 })
        this.tone({ freq: 92, endFreq: 44, dur: 0.28, gain: 0.22, type: 'sawtooth', attack: 0.004, release: 0.24, filter: 700 })
        this.noise(0.45, 0.28, 480)
        this.noise(0.3, 0.14, 1800, 'highpass', Math.random() * 0.6 - 0.3)
        break
      case 'pickup':
        ;[660, 880, 1100].forEach((f, i) =>
          this.tone({
            freq: f,
            dur: 0.14,
            gain: 0.1,
            type: 'sine',
            attack: 0.005,
            release: 0.12,
            delay: i * 0.06,
            pan: (i - 1) * 0.25,
          }),
        )
        this.noise(0.12, 0.05, 6000, 'highpass')
        break
      case 'damage':
        this.tone({ freq: 210, endFreq: 70, dur: 0.28, gain: 0.22, type: 'sawtooth', attack: 0.004, release: 0.24, filter: 1200 })
        this.noise(0.2, 0.16, 750)
        break
      case 'clear':
        ;[392, 494, 587, 784].forEach((f, i) =>
          this.tone({
            freq: f,
            dur: 0.28,
            gain: 0.11,
            type: 'triangle',
            attack: 0.01,
            release: 0.24,
            delay: i * 0.09,
          }),
        )
        break
      case 'ui':
        this.tone({ freq: 680, dur: 0.06, gain: 0.07, type: 'triangle', attack: 0.002, release: 0.05 })
        break
    }
  }

  // ---------- music scheduler ----------

  private startMusic() {
    if (this.musicStarted || !this.ctx) return
    this.musicStarted = true
    if (!this.bgmFailed) this.initBgm()
    if (!this.bgmReady) this.startSynthFallback()
  }

  /** Prefer the bundled mp3 track; synth pad is the offline/fallback layer. */
  private initBgm() {
    if (this.bgmEl || this.bgmFailed || !this.ctx || !this.musicGain) return
    const el = new Audio('audio/bgm-epic.mp3')
    el.loop = true
    el.preload = 'auto'
    el.crossOrigin = 'anonymous'
    el.addEventListener('error', () => {
      this.bgmFailed = true
      this.startSynthFallback()
    })
    el.addEventListener('canplaythrough', () => {
      if (this.bgmFailed || this.bgmReady) return
      this.bgmReady = true
      this.useSynth = false
      this.bgmEl = el
      void el.play().catch(() => {
        this.bgmFailed = true
        this.startSynthFallback()
      })
    })
    try {
      const node = this.ctx.createMediaElementSource(el)
      node.connect(this.musicGain)
    } catch {
      this.bgmFailed = true
      this.startSynthFallback()
    }
    el.load()
  }

  private startSynthFallback() {
    if (this.useSynth) return
    this.useSynth = true
    this.nextChordTime = this.ctx ? this.ctx.currentTime + 0.2 : 0
    this.chordIndex = 0
    window.setInterval(() => this.musicTick(), 40)
  }

  private musicTick() {
    if (!this.ctx || !this.useSynth) return
    const ahead = this.ctx.currentTime + 0.5
    while (this.nextChordTime < ahead) {
      this.scheduleChord(this.nextChordTime, this.chordIndex % CHORDS.length)
      this.nextChordTime += CHORD_DUR
      this.chordIndex += 1
    }
  }

  private scheduleChord(at: number, idx: number) {
    const chord = CHORDS[idx]!
    const root = chord[0]!

    // Warm pad — two detuned saws per note through a lowpass
    for (const f of chord) {
      for (const det of [-3, 3]) {
        this.padNote(f, det, at, idx)
      }
    }
    // Sub bass — sine at root, one octave down
    this.bassNote(root / 2, at, idx)

    // Arpeggio — quarter notes when idle, eighths in combat
    const step = this.combat ? BAR / 2 : BAR
    const degrees = [0, 1, 2, 1]
    for (let s = 0; s < 4; s++) {
      const f = chord[degrees[s % 4]!]! * 2
      this.pluck(f, at + s * step, s)
    }
  }

  private padNote(freq: number, det: number, at: number, idx: number) {
    if (!this.ctx || !this.musicGain) return
    const o = this.ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = freq
    o.detune.value = det
    const f = this.ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = this.combat ? 1200 : 780
    f.Q.value = 0.4
    const g = this.ctx.createGain()
    const v = 0.032 + (idx % 2) * 0.006
    g.gain.setValueAtTime(0.0001, at)
    g.gain.linearRampToValueAtTime(v, at + 1.4)
    g.gain.setValueAtTime(v, at + CHORD_DUR - 1.6)
    g.gain.linearRampToValueAtTime(0.0001, at + CHORD_DUR)
    o.connect(f)
    f.connect(g)
    g.connect(this.musicGain)
    o.start(at)
    o.stop(at + CHORD_DUR + 0.1)
  }

  private bassNote(freq: number, at: number, idx: number) {
    if (!this.ctx || !this.musicGain) return
    const o = this.ctx.createOscillator()
    o.type = idx % 2 === 0 ? 'sine' : 'triangle'
    o.frequency.value = freq
    const g = this.ctx.createGain()
    const v = 0.1
    g.gain.setValueAtTime(0.0001, at)
    g.gain.linearRampToValueAtTime(v, at + 0.35)
    g.gain.setValueAtTime(v, at + CHORD_DUR - 1)
    g.gain.linearRampToValueAtTime(0.0001, at + CHORD_DUR)
    o.connect(g)
    g.connect(this.musicGain)
    o.start(at)
    o.stop(at + CHORD_DUR + 0.1)
  }

  private pluck(freq: number, at: number, s: number) {
    if (!this.ctx || !this.musicGain) return
    if (s % 2 === 1 && !this.combat) return // sparse when idle
    const o = this.ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = freq
    const g = this.ctx.createGain()
    const v = 0.045
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(v, at + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5)
    const p = this.ctx.createStereoPanner()
    p.pan.value = (s % 4) / 2 - 0.75
    o.connect(g)
    g.connect(p)
    p.connect(this.musicGain)
    o.start(at)
    o.stop(at + 0.55)
  }

  // ---------- helpers ----------

  private tone(opts: ToneOpts) {
    if (!this.ctx || !this.sfxGain) return
    const t0 = this.ctx.currentTime + (opts.delay ?? 0)
    const o = this.ctx.createOscillator()
    o.type = opts.type ?? 'sine'
    o.frequency.setValueAtTime(opts.freq, t0)
    if (opts.endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.endFreq), t0 + opts.dur)
    let node: AudioNode = o
    if (opts.filter) {
      const f = this.ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.setValueAtTime(opts.filter, t0)
      if (opts.filterEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, opts.filterEnd), t0 + opts.dur)
      o.connect(f)
      node = f
    }
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(opts.gain, t0 + (opts.attack ?? 0.005))
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur)
    node.connect(g)
    if (opts.pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner()
      p.pan.value = opts.pan
      g.connect(p)
      p.connect(this.sfxGain)
    } else {
      g.connect(this.sfxGain)
    }
    o.start(t0)
    o.stop(t0 + opts.dur + 0.05)
  }

  private noise(
    dur: number,
    gain: number,
    filterFreq: number,
    type: BiquadFilterType = 'lowpass',
    pan?: number,
  ) {
    if (!this.ctx || !this.sfxGain || !this.noiseBuf) return
    const t0 = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const f = this.ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = filterFreq
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(f)
    f.connect(g)
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner()
      p.pan.value = pan
      g.connect(p)
      p.connect(this.sfxGain)
    } else {
      g.connect(this.sfxGain)
    }
    src.start(t0)
    src.stop(t0 + dur + 0.05)
  }
}

export const gameAudio = new GameAudio()
