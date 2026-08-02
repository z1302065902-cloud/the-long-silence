import './style.css'
import { Game } from './game/game'

function showBootError(err: unknown) {
  const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err)
  console.error(err)
  const el = document.createElement('pre')
  el.style.cssText =
    'position:fixed;inset:0;z-index:9999;margin:0;padding:24px;background:#12080a;color:#ffb4b4;font:13px/1.45 monospace;white-space:pre-wrap;overflow:auto'
  el.textContent = `The Long Silence failed to start:\n\n${msg}\n\nOpen DevTools Console for details.`
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
  showBootError(e.reason)
})
