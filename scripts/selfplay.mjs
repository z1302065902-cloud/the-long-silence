/**
 * Self-play 10 sessions, collect bugs and issues.
 */
import { chromium } from 'playwright'
import { homedir } from 'os'
import { existsSync, writeFileSync } from 'fs'

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

const SESSIONS = 10
const SESSION_DURATION = 60 // seconds per session — more time to find issues
const url = `http://127.0.0.1:5173/?autotest=${SESSIONS}`
const out = new URL('../selfplay-report.json', import.meta.url)

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errors: string[] = []
const warnings: string[] = []

page.on('pageerror', (err) => {
  errors.push(err.message)
  console.error('[PAGEERROR]', err.message)
})
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    errors.push(msg.text())
    console.error('[CONSOLE.ERR]', msg.text())
  } else if (msg.type() === 'warning') {
    warnings.push(msg.text())
  }
})

console.log('Opening', url)
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

// Wait for game + playtest setup
await page.waitForFunction(() => window.__PLAYTEST__ && window.__GAME__, { timeout: 30000 })

// Override session timeout to 60s and death limit to 5 for deeper testing
await page.evaluate((duration) => {
  const origEnd = window.__GAME__.endPlaySession
  // Monkey-patch: make sessions longer (use a different mechanism — adjust timer check)
  // Instead, just modify the sessionTimer check inside updateFlight by patching the game
  const game = window.__GAME__
  // We'll track time externally and end sessions ourselves
}, SESSION_DURATION)

const deadline = Date.now() + SESSIONS * (SESSION_DURATION + 5) * 1000
let lastCompleted = -1
const sessionResults: any[] = []

while (Date.now() < deadline) {
  const snap = await page.evaluate(() => {
    const p = window.__PLAYTEST__
    const g = window.__GAME__
    if (!p) return null
    return {
      done: p.done,
      completed: p.sessionsCompleted,
      kills: p.totalKills,
      deaths: p.totalDeaths,
      issues: p.uniqueIssues,
      errors: p.errors,
      playerHp: g?.combat?.playerHp,
      level: g?.combat?.levelId,
      wave: g?.combat?.statusLine?.()?.wave,
    }
  })
  if (!snap) {
    await page.waitForTimeout(1000)
    continue
  }
  if (snap.completed !== lastCompleted) {
    lastCompleted = snap.completed
    console.log(
      `session ${snap.completed}/${SESSIONS} kills=${snap.kills} deaths=${snap.deaths} issues=${snap.issues.length}`,
    )
    sessionResults.push({ ...snap })
  }
  if (snap.done) break
  await page.waitForTimeout(3000)
}

const finalReport = await page.evaluate(() => window.__PLAYTEST__)

// Also capture FPS samples over time
const fpsData = await page.evaluate(() => {
  return window.__PERF__ || null
})

const report = {
  sessions: SESSIONS,
  completed: finalReport?.sessionsCompleted ?? 0,
  totalKills: finalReport?.totalKills ?? 0,
  totalDeaths: finalReport?.totalDeaths ?? 0,
  uniqueIssues: finalReport?.uniqueIssues ?? [],
  errors,
  warnings: [...new Set(warnings)].slice(0, 20),
  sessionsDetail: finalReport?.sessions ?? [],
  sessionResults,
}

writeFileSync(out, JSON.stringify(report, null, 2))
console.log('\n=== Self-Play Report ===')
console.log(JSON.stringify({
  completed: report.completed,
  totalKills: report.totalKills,
  totalDeaths: report.totalDeaths,
  uniqueIssues: report.uniqueIssues,
  errorCount: report.errors.length,
}, null, 2))
console.log(`Wrote ${out.pathname}`)

await browser.close()
process.exit(report.errors.length > 0 ? 1 : 0)
