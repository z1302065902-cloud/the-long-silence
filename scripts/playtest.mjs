/**
 * Headless 50-run playtest against local Vite.
 * Usage: node scripts/playtest.mjs [sessions=50]
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'

const sessions = Number(process.argv[2] || 50)
const url = `http://127.0.0.1:5173/?autotest=${sessions}`
const out = new URL('../playtest-report.json', import.meta.url)

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
const page = await browser.newPage()
page.on('pageerror', (err) => console.error('[pageerror]', err.message))
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('[console]', msg.text())
})

console.log('Opening', url)
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })

const deadline = Date.now() + Math.max(180_000, sessions * 25_000)
let lastCompleted = -1
while (Date.now() < deadline) {
  const snap = await page.evaluate(() => {
    const p = window.__PLAYTEST__
    return p
      ? {
          done: p.done,
          completed: p.sessionsCompleted,
          kills: p.totalKills,
          deaths: p.totalDeaths,
          issues: p.uniqueIssues,
        }
      : null
  })
  if (!snap) {
    await page.waitForTimeout(1000)
    continue
  }
  if (snap.completed !== lastCompleted) {
    lastCompleted = snap.completed
    console.log(
      `progress ${snap.completed}/${sessions} kills=${snap.kills} deaths=${snap.deaths} issues=${snap.issues.length}`,
    )
  }
  if (snap.done) break
  await page.waitForTimeout(2000)
}
const report = await page.evaluate(() => window.__PLAYTEST__)
if (!report?.done) {
  console.error('Playtest timed out', report)
  await browser.close()
  process.exit(3)
}

writeFileSync(out, JSON.stringify(report, null, 2))
console.log('Wrote', out.pathname)
console.log(
  JSON.stringify(
    {
      sessions: report.sessionsCompleted,
      kills: report.totalKills,
      deaths: report.totalDeaths,
      issues: report.uniqueIssues,
      errors: report.errors,
      elapsedMs: (report.finishedAt || Date.now()) - report.startedAt,
    },
    null,
    2,
  ),
)

await browser.close()
process.exit(report.uniqueIssues.length > 8 ? 2 : 0)
