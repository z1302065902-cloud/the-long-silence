/**
 * Performance benchmark: measure FPS, draw calls, memory during combat.
 */
import { chromium } from 'playwright'
import { homedir } from 'os'
import { existsSync } from 'fs'

const chromeCandidates = [
  `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
  `${homedir()}/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
  `${homedir()}/Library/Caches/ms-playwright/chromium-1148/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
]
const executablePath = chromeCandidates.find((p) => existsSync(p))

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-webgl'],
})

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (err) => console.error('[pageerror]', err.message))

const url = 'http://127.0.0.1:5173/'
console.log('Opening', url)
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

// Wait for game to be ready
await page.waitForFunction(() => window.__GAME__, { timeout: 30000 })

// Inject FPS counter via THREE.js renderer info
await page.evaluate(() => {
  const g = window.__GAME__
  if (!g) return
  g._fpsFrames = 0
  g._fpsLast = performance.now()
  g._fpsSamples = []
  g._drawCallsSamples = []
  g._triangleSamples = []
  const origLoop = g.renderer?.info
  window._perfBaseline = {
    fps: 0,
    drawCalls: 0,
    triangles: 0,
    points: 0,
  }
})

// Start a game session (click launch)
await page.evaluate(() => {
  document.getElementById('launch-btn')?.click()
})

// Wait for combat to start, then measure for 10 seconds
await page.waitForTimeout(2000)

const metrics = await page.evaluate(async () => {
  const g = window.__GAME__
  const renderer = g.renderer
  const info = renderer.info
  
  const samples = []
  const start = performance.now()
  let frames = 0
  let lastTime = start
  
  // Collect 8 seconds of samples
  return new Promise((resolve) => {
    function sample() {
      frames++
      const now = performance.now()
      if (now - lastTime >= 500) {
        const fps = (frames * 1000) / (now - lastTime)
        samples.push({
          fps: Math.round(fps),
          drawCalls: info.render.calls,
          triangles: info.render.triangles,
          points: info.render.points,
          programs: info.programs?.length || 0,
          memoryGeometries: info.memory.geometries,
          memoryTextures: info.memory.textures,
        })
        // Reset counters for next sample
        info.reset()
        frames = 0
        lastTime = now
      }
      if (now - start < 8000) {
        requestAnimationFrame(sample)
      } else {
        // Compute averages
        const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
        resolve({
          avgFps: Math.round(avg(samples.map(s => s.fps))),
          minFps: Math.min(...samples.map(s => s.fps)),
          maxFps: Math.max(...samples.map(s => s.fps)),
          avgDrawCalls: Math.round(avg(samples.map(s => s.drawCalls))),
          avgTriangles: Math.round(avg(samples.map(s => s.triangles))),
          avgPoints: Math.round(avg(samples.map(s => s.points))),
          avgPrograms: Math.round(avg(samples.map(s => s.programs))),
          memoryGeometries: samples[0]?.memoryGeometries || 0,
          memoryTextures: samples[0]?.memoryTextures || 0,
          sampleCount: samples.length,
          samples,
        })
      }
    }
    sample()
  })
})

console.log('\n=== Performance Baseline ===')
console.log(JSON.stringify(metrics, null, 2))

await browser.close()
process.exit(0)
