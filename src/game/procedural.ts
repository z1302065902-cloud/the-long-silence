import {
  CanvasTexture,
  LinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three'

// ---------------------------------------------------------------------------
// Seeded PRNG (Mulberry32)
// ---------------------------------------------------------------------------

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash2D(x: number, y: number, seed: number): number {
  let h = seed + x * 374761393 + y * 668265263
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function rgb(r: number, g: number, b: number): [number, number, number] {
  return [clamp01(r), clamp01(g), clamp01(b)]
}

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

// ---------------------------------------------------------------------------
// Value noise (2D)
// ---------------------------------------------------------------------------

export function valueNoise2D(x: number, y: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi

  const v00 = hash2D(xi, yi, seed)
  const v10 = hash2D(xi + 1, yi, seed)
  const v01 = hash2D(xi, yi + 1, seed)
  const v11 = hash2D(xi + 1, yi + 1, seed)

  const u = fade(xf)
  const v = fade(yf)

  const x1 = lerp(v00, v10, u)
  const x2 = lerp(v01, v11, u)
  return lerp(x1, x2, v)
}

// ---------------------------------------------------------------------------
// Simplex-like gradient noise (2D, seeded)
// ---------------------------------------------------------------------------

const GRAD2: [number, number][] = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

function grad2(hash: number, x: number, y: number): number {
  const g = GRAD2[hash & 7]!
  return g[0] * x + g[1] * y
}

export function simplexNoise2D(x: number, y: number, seed: number): number {
  const F2 = 0.5 * (Math.sqrt(3) - 1)
  const G2 = (3 - Math.sqrt(3)) / 6

  const s = (x + y) * F2
  const i = Math.floor(x + s)
  const j = Math.floor(y + s)
  const t = (i + j) * G2
  const x0 = x - (i - t)
  const y0 = y - (j - t)

  const i1 = x0 > y0 ? 1 : 0
  const j1 = x0 > y0 ? 0 : 1

  const x1 = x0 - i1 + G2
  const y1 = y0 - j1 + G2
  const x2 = x0 - 1 + 2 * G2
  const y2 = y0 - 1 + 2 * G2

  const ii = i & 255
  const jj = j & 255

  let n0 = 0
  let n1 = 0
  let n2 = 0

  let t0 = 0.5 - x0 * x0 - y0 * y0
  if (t0 >= 0) {
    t0 *= t0
    n0 = t0 * t0 * grad2((hash2D(ii, jj, seed) * 255) | 0, x0, y0)
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1
  if (t1 >= 0) {
    t1 *= t1
    n1 = t1 * t1 * grad2((hash2D(ii + i1, jj + j1, seed) * 255) | 0, x1, y1)
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2
  if (t2 >= 0) {
    t2 *= t2
    n2 = t2 * t2 * grad2((hash2D(ii + 1, jj + 1, seed) * 255) | 0, x2, y2)
  }

  return 70 * (n0 + n1 + n2)
}

export function fbm2D(
  x: number,
  y: number,
  seed: number,
  octaves = 5,
  lacunarity = 2,
  gain = 0.5,
): number {
  let amp = 1
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * simplexNoise2D(x * freq, y * freq, seed + i * 131)
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}

// ---------------------------------------------------------------------------
// Planet texture generation
// ---------------------------------------------------------------------------

export type PlanetBiome = 'icy' | 'desert' | 'jungle'

export interface PlanetTextureSet {
  map: CanvasTexture
  bumpMap: CanvasTexture
}

interface BiomePalette {
  deep: [number, number, number]
  mid: [number, number, number]
  highlight: [number, number, number]
  accent: [number, number, number]
  ocean?: [number, number, number]
}

const BIOME_PALETTES: Record<PlanetBiome, BiomePalette> = {
  icy: {
    deep: rgb(0.04, 0.09, 0.14),
    mid: rgb(0.18, 0.32, 0.42),
    highlight: rgb(0.62, 0.78, 0.86),
    accent: rgb(0.35, 0.72, 0.78),
    ocean: rgb(0.05, 0.12, 0.2),
  },
  desert: {
    deep: rgb(0.12, 0.07, 0.04),
    mid: rgb(0.38, 0.24, 0.12),
    highlight: rgb(0.72, 0.52, 0.28),
    accent: rgb(0.85, 0.55, 0.18),
    ocean: rgb(0.08, 0.14, 0.16),
  },
  jungle: {
    deep: rgb(0.03, 0.08, 0.05),
    mid: rgb(0.1, 0.28, 0.16),
    highlight: rgb(0.22, 0.48, 0.28),
    accent: rgb(0.18, 0.62, 0.42),
    ocean: rgb(0.04, 0.1, 0.14),
  },
}

function samplePlanetColor(
  u: number,
  v: number,
  biome: PlanetBiome,
  seed: number,
): [number, number, number, number] {
  const palette = BIOME_PALETTES[biome]
  const lon = u * Math.PI * 2
  const lat = (v - 0.5) * Math.PI

  const nx = Math.cos(lat) * Math.cos(lon) * 3.5
  const ny = Math.cos(lat) * Math.sin(lon) * 3.5
  const nz = Math.sin(lat) * 3.5

  const continent = fbm2D(nx, ny + nz, seed, 6, 2.1, 0.52)
  const detail = fbm2D(nx * 4 + 12, ny * 4 - 7, seed + 17, 4, 2.4, 0.45)
  const ridges = Math.abs(simplexNoise2D(nx * 2.2, ny * 2.2, seed + 41))
  const craters = valueNoise2D(nx * 8, ny * 8, seed + 73)

  let t = continent * 0.65 + detail * 0.35
  t = smoothstep(clamp01(t * 0.5 + 0.25))

  const poleMask = Math.pow(Math.abs(Math.sin(lat)), biome === 'icy' ? 1.2 : 2.4)
  const equatorMask = 1 - poleMask

  let color: [number, number, number]
  if (t < 0.28 && palette.ocean) {
    color = lerpColor(palette.deep, palette.ocean, t / 0.28)
  } else if (t < 0.55) {
    color = lerpColor(palette.mid, palette.highlight, (t - 0.28) / 0.27)
  } else {
    color = lerpColor(palette.highlight, palette.accent, (t - 0.55) / 0.45)
  }

  if (biome === 'icy') {
    color = lerpColor(color, palette.highlight, poleMask * 0.55)
  } else if (biome === 'desert') {
    color = lerpColor(color, palette.accent, equatorMask * 0.15)
    if (craters > 0.92) {
      color = lerpColor(color, palette.deep, 0.35)
    }
  } else {
    color = lerpColor(color, palette.accent, equatorMask * ridges * 0.25)
  }

  const cloud = fbm2D(nx * 1.8 + 3, ny * 1.8 - 2, seed + 99, 3, 2, 0.5)
  if (cloud > 0.62) {
    const cloudAmt = smoothstep((cloud - 0.62) / 0.38)
    color = lerpColor(color, rgb(0.75, 0.78, 0.82), cloudAmt * 0.35)
  }

  const shade = 0.88 + ridges * 0.12
  return [color[0] * shade, color[1] * shade, color[2] * shade, 1]
}

function sampleBumpHeight(u: number, v: number, biome: PlanetBiome, seed: number): number {
  const lon = u * Math.PI * 2
  const lat = (v - 0.5) * Math.PI
  const nx = Math.cos(lat) * Math.cos(lon) * 3.5
  const ny = Math.cos(lat) * Math.sin(lon) * 3.5
  const nz = Math.sin(lat) * 3.5

  const base = fbm2D(nx, ny + nz, seed + 200, 5, 2.2, 0.48)
  const detail = fbm2D(nx * 6, ny * 6, seed + 311, 3, 2.5, 0.4)
  const crater = valueNoise2D(nx * 10, ny * 10, seed + 401)

  let h = base * 0.7 + detail * 0.3
  if (biome === 'desert' && crater > 0.9) {
    h -= (crater - 0.9) * 2.5
  }
  if (biome === 'icy') {
    h += Math.pow(Math.abs(Math.sin(lat)), 2) * 0.15
  }
  return clamp01(h)
}

export function createPlanetTextures(
  biome: PlanetBiome,
  seed: number,
  size = 1024,
): PlanetTextureSet {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(size, size)

  const bumpCanvas = document.createElement('canvas')
  bumpCanvas.width = size
  bumpCanvas.height = size
  const bumpCtx = bumpCanvas.getContext('2d')!
  const bumpImage = bumpCtx.createImageData(size, size)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      const idx = (y * size + x) * 4

      const [r, g, b, a] = samplePlanetColor(u, v, biome, seed)
      image.data[idx] = Math.round(r * 255)
      image.data[idx + 1] = Math.round(g * 255)
      image.data[idx + 2] = Math.round(b * 255)
      image.data[idx + 3] = Math.round(a * 255)

      const h = sampleBumpHeight(u, v, biome, seed)
      const bumpVal = Math.round(h * 255)
      bumpImage.data[idx] = bumpVal
      bumpImage.data[idx + 1] = bumpVal
      bumpImage.data[idx + 2] = bumpVal
      bumpImage.data[idx + 3] = 255
    }
  }

  ctx.putImageData(image, 0, 0)
  bumpCtx.putImageData(bumpImage, 0, 0)

  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  map.wrapS = RepeatWrapping
  map.wrapT = RepeatWrapping
  map.minFilter = LinearFilter
  map.magFilter = LinearFilter

  const bumpMap = new CanvasTexture(bumpCanvas)
  bumpMap.wrapS = RepeatWrapping
  bumpMap.wrapT = RepeatWrapping
  bumpMap.minFilter = LinearFilter
  bumpMap.magFilter = LinearFilter

  return { map, bumpMap }
}

/** Soft cloud coverage map for translucent shell layers. */
export function createCloudTexture(seed: number, size = 512): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      const n =
        fbm2D(u * 5, v * 3, seed, 5) * 0.65 +
        fbm2D(u * 12, v * 8, seed + 9, 3) * 0.35
      const c = Math.pow(Math.max(0, n - 0.42) / 0.58, 1.35)
      const i = (y * size + x) * 4
      const g = Math.round(c * 255)
      img.data[i] = g
      img.data[i + 1] = g
      img.data[i + 2] = g
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new CanvasTexture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.colorSpace = SRGBColorSpace
  return tex
}

// ---------------------------------------------------------------------------
// Starfield themes — one palette per campaign chapter
// ---------------------------------------------------------------------------

export type StarfieldTheme = {
  id: number
  name: string
  base: string
  nebulae: { x: number; y: number; r: number; color: string }[]
  warmColor: string
  coolColor: string
  violetColor: string
  neutralColor: string
  warmChance: number
  coolChance: number
  violetChance: number
  densityMul: number
  nebulaLayers: string[]
  sparkleR: number
  sparkleG: number
  sparkleB: number
}

export const STARFIELD_THEMES: StarfieldTheme[] = [
  {
    id: 1,
    name: '边境试炼',
    base: '#040810',
    nebulae: [
      { x: 0.35, y: 0.45, r: 0.55, color: 'rgba(18, 48, 58, 0.55)' },
      { x: 0.72, y: 0.28, r: 0.35, color: 'rgba(72, 42, 12, 0.32)' },
      { x: 0.12, y: 0.72, r: 0.28, color: 'rgba(48, 24, 72, 0.28)' },
    ],
    warmColor: 'rgba(240, 180, 90, ',
    coolColor: 'rgba(140, 230, 230, ',
    violetColor: 'rgba(170, 130, 240, ',
    neutralColor: 'rgba(210, 220, 240, ',
    warmChance: 0.015,
    coolChance: 0.015,
    violetChance: 0.01,
    densityMul: 1,
    nebulaLayers: [
      'rgba(28, 96, 108, 0.38)',
      'rgba(40, 128, 132, 0.42)',
      'rgba(56, 148, 142, 0.32)',
      'rgba(220, 130, 58, 0.22)',
    ],
    sparkleR: 120,
    sparkleG: 180,
    sparkleB: 200,
  },
  {
    id: 2,
    name: '矿带猎杀',
    base: '#0b0704',
    nebulae: [
      { x: 0.3, y: 0.4, r: 0.6, color: 'rgba(96, 48, 14, 0.55)' },
      { x: 0.75, y: 0.3, r: 0.4, color: 'rgba(130, 64, 18, 0.42)' },
      { x: 0.15, y: 0.78, r: 0.3, color: 'rgba(70, 34, 10, 0.3)' },
      { x: 0.55, y: 0.62, r: 0.34, color: 'rgba(150, 84, 26, 0.3)' },
    ],
    warmColor: 'rgba(255, 190, 110, ',
    coolColor: 'rgba(200, 150, 120, ',
    violetColor: 'rgba(210, 140, 170, ',
    neutralColor: 'rgba(240, 220, 200, ',
    warmChance: 0.045,
    coolChance: 0.01,
    violetChance: 0.008,
    densityMul: 1.08,
    nebulaLayers: [
      'rgba(120, 58, 16, 0.4)',
      'rgba(160, 76, 24, 0.44)',
      'rgba(190, 100, 34, 0.34)',
      'rgba(220, 140, 60, 0.2)',
    ],
    sparkleR: 220,
    sparkleG: 160,
    sparkleB: 110,
  },
  {
    id: 3,
    name: '静默航道',
    base: '#060410',
    nebulae: [
      { x: 0.32, y: 0.42, r: 0.6, color: 'rgba(70, 22, 96, 0.5)' },
      { x: 0.74, y: 0.3, r: 0.38, color: 'rgba(96, 30, 120, 0.42)' },
      { x: 0.12, y: 0.7, r: 0.32, color: 'rgba(40, 16, 72, 0.4)' },
      { x: 0.6, y: 0.72, r: 0.3, color: 'rgba(120, 46, 150, 0.32)' },
    ],
    warmColor: 'rgba(250, 200, 150, ',
    coolColor: 'rgba(150, 200, 250, ',
    violetColor: 'rgba(190, 130, 255, ',
    neutralColor: 'rgba(210, 200, 245, ',
    warmChance: 0.008,
    coolChance: 0.01,
    violetChance: 0.045,
    densityMul: 1.14,
    nebulaLayers: [
      'rgba(70, 22, 96, 0.4)',
      'rgba(96, 34, 124, 0.44)',
      'rgba(124, 50, 150, 0.34)',
      'rgba(170, 90, 200, 0.2)',
    ],
    sparkleR: 170,
    sparkleG: 140,
    sparkleB: 230,
  },
  {
    id: 4,
    name: '终焉回响',
    base: '#0c0405',
    nebulae: [
      { x: 0.35, y: 0.4, r: 0.62, color: 'rgba(120, 20, 24, 0.55)' },
      { x: 0.74, y: 0.28, r: 0.4, color: 'rgba(140, 72, 20, 0.45)' },
      { x: 0.14, y: 0.72, r: 0.34, color: 'rgba(90, 16, 26, 0.4)' },
      { x: 0.58, y: 0.66, r: 0.34, color: 'rgba(170, 90, 22, 0.34)' },
    ],
    warmColor: 'rgba(255, 190, 90, ',
    coolColor: 'rgba(255, 120, 120, ',
    violetColor: 'rgba(230, 100, 150, ',
    neutralColor: 'rgba(245, 215, 200, ',
    warmChance: 0.05,
    coolChance: 0.02,
    violetChance: 0.012,
    densityMul: 1.1,
    nebulaLayers: [
      'rgba(120, 18, 22, 0.42)',
      'rgba(160, 34, 30, 0.44)',
      'rgba(190, 64, 40, 0.34)',
      'rgba(230, 140, 60, 0.2)',
    ],
    sparkleR: 240,
    sparkleG: 170,
    sparkleB: 130,
  },
]

export function getStarfieldTheme(id: number): StarfieldTheme {
  const t = STARFIELD_THEMES.find((x) => x.id === id)
  return t ?? STARFIELD_THEMES[0]
}

// ---------------------------------------------------------------------------
// Starfield texture
// ---------------------------------------------------------------------------

export function createStarfieldTexture(
  width = 2048,
  height = 1024,
  seed = 42,
  starCount = 5800,
  themeId = 1,
): CanvasTexture {
  const theme = getStarfieldTheme(themeId)
  const rand = createSeededRandom(seed)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = theme.base
  ctx.fillRect(0, 0, width, height)

  for (const n of theme.nebulae) {
    const grad = ctx.createRadialGradient(
      width * n.x,
      height * n.y,
      0,
      width * n.x,
      height * n.y,
      width * n.r,
    )
    grad.addColorStop(0, n.color)
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)
  }

  const count = Math.floor(starCount * theme.densityMul)
  for (let i = 0; i < count; i++) {
    const x = rand() * width
    const y = rand() * height
    const roll = rand()
    let radius: number
    let alpha: number
    let color: string

    if (roll > 1 - theme.warmChance) {
      radius = 1.6 + rand() * 1.4
      alpha = 0.85 + rand() * 0.15
      color = theme.warmColor
    } else if (roll > 1 - theme.warmChance - theme.coolChance) {
      radius = 1.6 + rand() * 1.4
      alpha = 0.85 + rand() * 0.15
      color = theme.coolColor
    } else if (roll > 1 - theme.warmChance - theme.coolChance - theme.violetChance) {
      radius = 1.2 + rand() * 1.0
      alpha = 0.75 + rand() * 0.2
      color = theme.violetColor
    } else if (roll > 0.92) {
      radius = 1.0 + rand() * 0.7
      alpha = 0.55 + rand() * 0.4
      color = theme.neutralColor
    } else {
      radius = 0.35 + rand() * 0.55
      alpha = 0.22 + rand() * 0.5
      color = theme.neutralColor
    }

    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = color + alpha + ')'
    ctx.fill()

    if (radius > 1.2) {
      ctx.beginPath()
      ctx.arc(x, y, radius * 2.5, 0, Math.PI * 2)
      ctx.fillStyle = color + alpha * 0.15 + ')'
      ctx.fill()
    }
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  return texture
}

// ---------------------------------------------------------------------------
// Nebula sprite canvas
// ---------------------------------------------------------------------------

export function createNebulaSpriteCanvas(size = 512, seed = 7, themeId = 1): HTMLCanvasElement {
  const theme = getStarfieldTheme(themeId)
  const rand = createSeededRandom(seed)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.clearRect(0, 0, size, size)

  const cx = size * (0.45 + rand() * 0.1)
  const cy = size * (0.5 + rand() * 0.08)

  const layers = [
    { r: size * 0.42, color: theme.nebulaLayers[0]! },
    { r: size * 0.32, color: theme.nebulaLayers[1]! },
    { r: size * 0.22, color: theme.nebulaLayers[2]! },
    { r: size * 0.14, color: theme.nebulaLayers[3]! },
  ]

  for (const layer of layers) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, layer.r)
    grad.addColorStop(0, layer.color)
    grad.addColorStop(0.55, layer.color.replace(/[\d.]+\)$/, '0.08)'))
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
  }

  for (let i = 0; i < 120; i++) {
    const angle = rand() * Math.PI * 2
    const dist = rand() * size * 0.35
    const x = cx + Math.cos(angle) * dist
    const y = cy + Math.sin(angle) * dist
    const r = 0.5 + rand() * 2
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${theme.sparkleR + rand() * 60}, ${theme.sparkleG + rand() * 40}, ${theme.sparkleB + rand() * 30}, ${0.04 + rand() * 0.08})`
    ctx.fill()
  }

  return canvas
}

export function createNebulaSpriteTexture(size = 512, seed = 7, themeId = 1): Texture {
  const canvas = createNebulaSpriteCanvas(size, seed, themeId)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  return texture
}

// ---------------------------------------------------------------------------
// Environment backdrops — chapter 1 stays in starfield; later levels fly
// through underwater, forest, snow, desert and alien-planet sky regions.
// ---------------------------------------------------------------------------

export type EnvId = 'space' | 'underwater' | 'forest' | 'snow' | 'desert' | 'alien'

export type EnvParticleType = 'bubbles' | 'snow' | 'dust' | 'fireflies' | 'spores'

export type EnvPalette = {
  id: EnvId
  name: string
  fogColor: number
  fogDensity: number
  bgColor: number
  ambientColor: number
  ambient: number
  hemiSky: number
  hemiGround: number
  hemi: number
  rimColor: number
  rim: number
  keyColor: number
  key: number
  particle?: {
    type: EnvParticleType
    count: number
    size: number
    rgb: [number, number, number]
    speed: number
    opacity: number
    sway: number
    additive: boolean
    wrap: 'top' | 'bottom' | 'both'
  }
}

/** Non-space environments, cycled per level after chapter 1. */
export const ENV_ORDER: EnvId[] = ['underwater', 'forest', 'snow', 'desert', 'alien']

/** Chapter 1 = starfield; later levels cycle one environment per level. */
export function environmentForLevel(level: number): EnvId {
  if (level <= 5) return 'space'
  return ENV_ORDER[(level - 6) % ENV_ORDER.length]
}

export const ENV_PALETTES: Record<EnvId, EnvPalette> = {
  space: {
    id: 'space',
    name: '深空',
    fogColor: 0x0c1424,
    fogDensity: 0.000055,
    bgColor: 0x070b14,
    ambientColor: 0x3a5078,
    ambient: 1.15,
    hemiSky: 0xa8c8ea,
    hemiGround: 0x2a2030,
    hemi: 0.95,
    rimColor: 0xb5e0ff,
    rim: 1.05,
    keyColor: 0xfff0d8,
    key: 1.2,
  },
  underwater: {
    id: 'underwater',
    name: '海底',
    fogColor: 0x0a3a44,
    fogDensity: 0.00009,
    bgColor: 0x05303a,
    ambientColor: 0x1c5a66,
    ambient: 1.0,
    hemiSky: 0x6fd6d0,
    hemiGround: 0x0a2830,
    hemi: 0.9,
    rimColor: 0x9fe8e0,
    rim: 0.9,
    keyColor: 0xd8fdf5,
    key: 1.0,
    particle: {
      type: 'bubbles',
      count: 260,
      size: 5,
      rgb: [180, 230, 235],
      speed: 15,
      opacity: 0.5,
      sway: 6,
      additive: true,
      wrap: 'top',
    },
  },
  forest: {
    id: 'forest',
    name: '森林',
    fogColor: 0x0c2a18,
    fogDensity: 0.00011,
    bgColor: 0x071a10,
    ambientColor: 0x1e4a2e,
    ambient: 1.0,
    hemiSky: 0x9adfc0,
    hemiGround: 0x0a1f12,
    hemi: 0.9,
    rimColor: 0xb7f0d2,
    rim: 0.8,
    keyColor: 0xefffd8,
    key: 1.0,
    particle: {
      type: 'fireflies',
      count: 140,
      size: 7,
      rgb: [210, 255, 150],
      speed: 4,
      opacity: 0.9,
      sway: 14,
      additive: true,
      wrap: 'both',
    },
  },
  snow: {
    id: 'snow',
    name: '雪山',
    fogColor: 0x3a5068,
    fogDensity: 0.0001,
    bgColor: 0x20324a,
    ambientColor: 0x9ab4d8,
    ambient: 1.2,
    hemiSky: 0xd8ecff,
    hemiGround: 0x3a4a5c,
    hemi: 1.0,
    rimColor: 0xe8f4ff,
    rim: 1.1,
    keyColor: 0xffffff,
    key: 1.15,
    particle: {
      type: 'snow',
      count: 420,
      size: 6,
      rgb: [255, 255, 255],
      speed: 16,
      opacity: 0.8,
      sway: 4,
      additive: false,
      wrap: 'bottom',
    },
  },
  desert: {
    id: 'desert',
    name: '戈壁',
    fogColor: 0x8a4a1c,
    fogDensity: 0.000075,
    bgColor: 0x6b3410,
    ambientColor: 0x8a5a2a,
    ambient: 1.1,
    hemiSky: 0xffd9a8,
    hemiGround: 0x5a3214,
    hemi: 1.0,
    rimColor: 0xffcf9e,
    rim: 1.1,
    keyColor: 0xffe8c0,
    key: 1.25,
    particle: {
      type: 'dust',
      count: 200,
      size: 6,
      rgb: [255, 190, 120],
      speed: 5,
      opacity: 0.5,
      sway: 14,
      additive: false,
      wrap: 'both',
    },
  },
  alien: {
    id: 'alien',
    name: '外星球',
    fogColor: 0x2a1450,
    fogDensity: 0.0001,
    bgColor: 0x1a0a30,
    ambientColor: 0x4a2a78,
    ambient: 1.05,
    hemiSky: 0xc8a0f0,
    hemiGround: 0x2a1240,
    hemi: 1.0,
    rimColor: 0xd8b8ff,
    rim: 1.0,
    keyColor: 0xffb8f0,
    key: 1.1,
    particle: {
      type: 'spores',
      count: 220,
      size: 6,
      rgb: [160, 240, 255],
      speed: 6,
      opacity: 0.8,
      sway: 10,
      additive: true,
      wrap: 'both',
    },
  },
}

/**
 * Equirectangular sky dome texture for a non-space environment.
 * Space keeps using the dedicated starfield painter instead.
 */
export function createEnvironmentTexture(
  id: EnvId,
  seed: number,
  width = 2048,
  height = 1024,
): CanvasTexture {
  if (id === 'space') {
    return createStarfieldTexture(width, height, seed, 5800, 1)
  }
  const rand = createSeededRandom(seed)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const w = width
  const h = height

  const skyTop: Record<Exclude<EnvId, 'space'>, string> = {
    underwater: '#03202c',
    forest: '#03110b',
    snow: '#18283f',
    desert: '#241203',
    alien: '#0b0218',
  }
  const skyMid: Record<Exclude<EnvId, 'space'>, string> = {
    underwater: '#053a46',
    forest: '#0d2f1c',
    snow: '#3a5878',
    desert: '#6b3a12',
    alien: '#24103a',
  }
  const skyBottom: Record<Exclude<EnvId, 'space'>, string> = {
    underwater: '#0a4a4f',
    forest: '#0c3a22',
    snow: '#9fbcd6',
    desert: '#c98a3c',
    alien: '#43185c',
  }

  const grad = ctx.createLinearGradient(0, 0, 0, h)
  const ns = id as Exclude<EnvId, 'space'>
  grad.addColorStop(0, skyTop[ns])
  grad.addColorStop(0.55, skyMid[ns])
  grad.addColorStop(1, skyBottom[ns])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  switch (id) {
    case 'underwater': {
      for (let i = 0; i < 6; i++) {
        const sx = rand() * w
        const sw = 40 + rand() * 90
        const sh = h * (0.5 + rand() * 0.25)
        const sg = ctx.createLinearGradient(0, 0, 0, sh)
        sg.addColorStop(0, 'rgba(190, 240, 235, 0.1)')
        sg.addColorStop(1, 'rgba(190, 240, 235, 0)')
        ctx.save()
        ctx.translate(sx, 0)
        ctx.rotate((rand() - 0.5) * 0.06)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(sw, 0)
        ctx.lineTo(sw * 0.7, sh)
        ctx.lineTo(sw * 0.3, sh)
        ctx.closePath()
        ctx.fillStyle = sg
        ctx.fill()
        ctx.restore()
      }
      for (let i = 0; i < 60; i++) {
        const bx = rand() * w
        const by = rand() * h
        const br = 0.6 + rand() * 2.2
        ctx.beginPath()
        ctx.arc(bx, by, br, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(210, 240, 240, ${0.1 + rand() * 0.18})`
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.25, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(230, 250, 250, 0.35)'
        ctx.fill()
      }
      ctx.fillStyle = 'rgba(3, 18, 20, 0.85)'
      for (let i = 0; i < 14; i++) {
        const kx = rand() * w
        const kh = h * (0.08 + rand() * 0.12)
        const sway = (rand() - 0.5) * 30
        ctx.beginPath()
        ctx.moveTo(kx, h)
        ctx.quadraticCurveTo(kx + sway, h - kh * 0.6, kx + sway * 1.5, h - kh)
        ctx.quadraticCurveTo(kx + sway, h - kh * 0.8, kx - 6, h - kh * 0.75)
        ctx.quadraticCurveTo(kx - 10, h - kh * 0.4, kx - 4, h)
        ctx.closePath()
        ctx.fill()
      }
      break
    }
    case 'forest': {
      for (let i = 0; i < 60; i++) {
        const cx = rand() * w
        const cy = h * (0.68 + rand() * 0.32)
        const cr = 20 + rand() * 130
        ctx.beginPath()
        ctx.arc(cx, cy, cr, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(4, 20, 12, ${0.75 + rand() * 0.2})`
        ctx.fill()
      }
      const mg = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.85)
      mg.addColorStop(0, 'rgba(160, 230, 190, 0)')
      mg.addColorStop(0.5, 'rgba(150, 220, 185, 0.1)')
      mg.addColorStop(1, 'rgba(150, 220, 185, 0)')
      ctx.fillStyle = mg
      ctx.fillRect(0, h * 0.5, w, h * 0.4)
      const glow = ctx.createRadialGradient(w * 0.78, h * 0.2, 0, w * 0.78, h * 0.2, w * 0.3)
      glow.addColorStop(0, 'rgba(190, 240, 210, 0.25)')
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)
      break
    }
    case 'snow': {
      const ridge = (color: string, baseY: number, amp: number, step: number) => {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.moveTo(0, h)
        let prev = baseY
        for (let x = 0; x <= w; x += step) {
          const y = baseY - rand() * amp
          ctx.lineTo(x, prev)
          prev = y
        }
        ctx.lineTo(w, h)
        ctx.closePath()
        ctx.fill()
      }
      ridge('rgba(28, 44, 64, 0.95)', h * 0.62, h * 0.2, 48)
      ridge('rgba(16, 28, 44, 0.95)', h * 0.78, h * 0.14, 64)
      const aur = ctx.createLinearGradient(0, 0, 0, h * 0.35)
      aur.addColorStop(0, 'rgba(90, 200, 220, 0)')
      aur.addColorStop(0.5, 'rgba(90, 220, 210, 0.12)')
      aur.addColorStop(1, 'rgba(90, 200, 220, 0)')
      ctx.fillStyle = aur
      ctx.fillRect(0, 0, w, h * 0.35)
      break
    }
    case 'desert': {
      const sunX = w * 0.7
      const sunY = h * 0.62
      const sunR = w * 0.045
      const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 3.2)
      sg.addColorStop(0, 'rgba(255, 230, 170, 0.95)')
      sg.addColorStop(0.35, 'rgba(255, 190, 110, 0.55)')
      sg.addColorStop(1, 'rgba(255, 190, 110, 0)')
      ctx.fillStyle = sg
      ctx.fillRect(0, 0, w, h)
      ctx.beginPath()
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 240, 200, 1)'
      ctx.fill()
      ctx.fillStyle = 'rgba(46, 22, 8, 0.9)'
      for (let i = 0; i < 8; i++) {
        const mx = rand() * w
        const mw = w * (0.05 + rand() * 0.09)
        const mh = h * (0.06 + rand() * 0.08)
        ctx.fillRect(mx, h - mh, mw, mh)
      }
      for (let i = 0; i < 6; i++) {
        const dx = rand() * w
        const dw = w * (0.12 + rand() * 0.2)
        const dh = h * (0.06 + rand() * 0.1)
        ctx.beginPath()
        ctx.moveTo(dx - dw, h)
        ctx.quadraticCurveTo(dx, h - dh, dx + dw, h)
        ctx.closePath()
        ctx.fillStyle = 'rgba(96, 46, 14, 0.85)'
        ctx.fill()
      }
      break
    }
    case 'alien': {
      const px = w * 0.68
      const py = h * 0.3
      const pr = w * 0.07
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(-0.35)
      ctx.beginPath()
      ctx.ellipse(0, 0, pr * 1.9, pr * 0.55, 0, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(220, 170, 255, 0.5)'
      ctx.lineWidth = pr * 0.18
      ctx.stroke()
      ctx.restore()
      const pg = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.1, px, py, pr)
      pg.addColorStop(0, 'rgba(190, 140, 255, 0.9)')
      pg.addColorStop(1, 'rgba(70, 30, 120, 0.95)')
      ctx.beginPath()
      ctx.arc(px, py, pr, 0, Math.PI * 2)
      ctx.fillStyle = pg
      ctx.fill()
      for (let i = 0; i < 8; i++) {
        const gx = rand() * w
        const gy = rand() * h * 0.7
        const gr = w * (0.05 + rand() * 0.12)
        const gc = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr)
        gc.addColorStop(0, `rgba(${140 + rand() * 60}, 40, ${150 + rand() * 80}, 0.22)`)
        gc.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = gc
        ctx.fillRect(0, 0, w, h)
      }
      ctx.fillStyle = 'rgba(14, 6, 24, 0.9)'
      for (let i = 0; i < 10; i++) {
        const sx = rand() * w
        const sh = h * (0.06 + rand() * 0.12)
        ctx.beginPath()
        ctx.moveTo(sx, h)
        ctx.lineTo(sx - 6, h - sh)
        ctx.lineTo(sx + 6, h - sh)
        ctx.closePath()
        ctx.fill()
      }
      for (let i = 0; i < 40; i++) {
        const sx = rand() * w
        const sy = rand() * h
        ctx.strokeStyle = `rgba(160, 240, 255, ${0.2 + rand() * 0.4})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(sx - 3, sy)
        ctx.lineTo(sx + 3, sy)
        ctx.moveTo(sx, sy - 3)
        ctx.lineTo(sx, sy + 3)
        ctx.stroke()
      }
      break
    }
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  return texture
}

/** Soft particle sprite, tinted via PointsMaterial.color. */
export function createEnvParticleTexture(rgb: [number, number, number], type: EnvParticleType): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const [r, g, b] = rgb
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, `rgba(255, 255, 255, 0.95)`)
  grad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.7)`)
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)

  if (type === 'snow') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(32, 16)
    ctx.lineTo(32, 48)
    ctx.moveTo(16, 32)
    ctx.lineTo(48, 32)
    ctx.stroke()
  } else if (type === 'bubbles') {
    ctx.strokeStyle = 'rgba(220, 245, 245, 0.8)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(32, 32, 20, 0, Math.PI * 2)
    ctx.stroke()
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  return texture
}
