import './style.css'
import { Game } from './game/game'

let errorShown = false

function showBootError(err: unknown) {
  if (errorShown) return
  errorShown = true
  const msg = err instanceof Error ? err.message : String(err)
  console.error(err)
  const el = document.createElement('div')
  el.style.cssText =
    'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#0a0e14;color:#ffb4b4;font-family:system-ui,sans-serif;padding:24px;text-align:center'
  const title = document.createElement('div')
  title.style.cssText = 'font-size:18px;font-weight:600;letter-spacing:.08em'
  title.textContent = 'The Long Silence 遇到问题'
  const detail = document.createElement('div')
  detail.style.cssText = 'font-size:13px;opacity:.8;max-width:480px;line-height:1.6;word-break:break-word'
  detail.textContent = msg
  const btn = document.createElement('button')
  btn.textContent = '重新加载'
  btn.style.cssText =
    'cursor:pointer;border:1px solid rgba(255,180,180,.5);background:rgba(255,180,180,.1);color:#ffd0d0;font:inherit;padding:10px 22px;border-radius:6px'
  btn.addEventListener('click', () => location.reload())
  el.append(title, detail, btn)
  document.body.appendChild(el)
}

try {
  const canvas = document.querySelector<HTMLCanvasElement>('#c')
  if (!canvas) throw new Error('canvas #c missing')
  const game = new Game(canvas)
  game.start()
} catch (err) {
  showBootError(err)
}

window.addEventListener('unhandledrejection', (e) => {
  // Ignore benign asset-load rejections that already fall back gracefully.
  const reason = e.reason
  if (reason instanceof Error && /Failed to fetch|load timeout/i.test(reason.message)) return
  showBootError(reason)
})

// Catch unexpected runtime errors and surface a friendly recovery screen.
window.addEventListener('error', (e) => {
  if (e.message && /Script error\./i.test(e.message)) return
  showBootError(e.error ?? e.message)
})
