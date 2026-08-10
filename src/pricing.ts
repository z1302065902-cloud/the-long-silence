/**
 * 定价页逻辑（原生 TS，无 React）。
 *
 * - 用 @paddle/paddle-js 的 PricePreview 获取本地化价格
 * - 月/年切换
 * - 每档 Subscribe 按钮用 Paddle.Checkout.open 打开 overlay
 *
 * 环境变量（由 Vite 构建时注入）：
 *  - VITE_PADDLE_CLIENT_TOKEN : Paddle 客户端 token（live_ 开头）
 *  - VITE_PADDLE_ENV          : live | sandbox
 */
import { initializePaddle, type Paddle as PaddleInstance } from '@paddle/paddle-js'

// ===== Tier 定义（方便编辑） =====
export interface Tier {
  name: 'Starter' | 'Pro' | 'Advanced'
  description: string
  features: string[]
  priceId: { month: string; year: string }
}

const TIERS: Tier[] = [
  {
    name: 'Starter',
    description: 'For casual pilots exploring the outer belt.',
    features: ['Full 20-level campaign', '4 premium ships', 'Cloud save'],
    priceId: {
      month: import.meta.env.VITE_PADDLE_PRICE_STARTER_MONTH || '',
      year: import.meta.env.VITE_PADDLE_PRICE_STARTER_YEAR || '',
    },
  },
  {
    name: 'Pro',
    description: 'For serious commanders. All ships, all weapons.',
    features: ['Everything in Starter', 'All 5 premium ships', 'Exclusive liveries', 'Priority support'],
    priceId: {
      month: import.meta.env.VITE_PADDLE_PRICE_PRO_MONTH || '',
      year: import.meta.env.VITE_PADDLE_PRICE_PRO_YEAR || '',
    },
  },
  {
    name: 'Advanced',
    description: 'The full armada. Early access to new content.',
    features: ['Everything in Pro', 'Early access chapters', 'Founder badge', 'Direct dev access'],
    priceId: {
      month: import.meta.env.VITE_PADDLE_PRICE_ADVANCED_MONTH || '',
      year: import.meta.env.VITE_PADDLE_PRICE_ADVANCED_YEAR || '',
    },
  },
]

// 从 /api/geo 拿国家（Vercel 边缘函数读 x-vercel-ip-country）
async function getCountry(): Promise<string | undefined> {
  try {
    const res = await fetch('/api/geo')
    if (!res.ok) return undefined
    const data = (await res.json()) as { country?: string | null }
    return data.country || undefined
  } catch {
    return undefined
  }
}

// ===== 页面逻辑 =====
let paddle: PaddleInstance | undefined
let monthly = true

const grid = document.getElementById('tier-grid') as HTMLElement
const loading = document.getElementById('loading') as HTMLElement
const errorEl = document.getElementById('error') as HTMLElement

function showError(msg: string) {
  loading.style.display = 'none'
  errorEl.style.display = 'block'
  errorEl.textContent = msg
}

function renderPrices(prices: Record<string, { formatted: string }>) {
  grid.innerHTML = ''
  TIERS.forEach((tier) => {
    const priceId = monthly ? tier.priceId.month : tier.priceId.year
    const formatted = prices[priceId]?.formatted ?? '—'

    const card = document.createElement('div')
    card.className = 'tier' + (tier.name === 'Pro' ? ' featured' : '')
    card.innerHTML = `
      <div class="tier-name">${tier.name}</div>
      <div class="tier-desc">${tier.description}</div>
      <div class="price">${formatted}</div>
      <div class="price-bill">${monthly ? 'per month' : 'per year'}</div>
      <ul class="features">${tier.features.map((f) => `<li>${f}</li>`).join('')}</ul>
      <button class="subscribe" data-price-id="${priceId}">Subscribe</button>
    `
    grid.appendChild(card)
  })

  grid.querySelectorAll<HTMLButtonElement>('.subscribe').forEach((btn) => {
    btn.addEventListener('click', () => {
      const priceId = btn.dataset.priceId
      if (!paddle || !priceId) return
      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        settings: {
          displayMode: 'overlay',
          variant: 'one-page',
          theme: 'dark',
          successUrl: `${window.location.origin}/welcome`,
        },
      })
    })
  })

  loading.style.display = 'none'
  grid.style.display = 'grid'
}

async function loadPrices() {
  if (!paddle) return
  const allPriceIds = TIERS.flatMap((t) => [t.priceId.month, t.priceId.year]).filter(Boolean)
  const country = await getCountry()
  try {
    const preview = await paddle.PricePreview({
      items: allPriceIds.map((priceId) => ({ priceId, quantity: 1 })),
      // 服务端检测不到国家时不传 address → Paddle 自动检测 IP
      address: country ? { countryCode: country } : undefined,
    })
    const prices: Record<string, { formatted: string }> = {}
    for (const line of preview?.data?.details?.lineItems ?? []) {
      prices[line.price.id] = { formatted: line.formattedTotals?.total ?? '' }
    }
    renderPrices(prices)
  } catch (e) {
    showError('Failed to load prices: ' + (e as Error).message)
  }
}

async function init() {
  const clientToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN
  const env = import.meta.env.VITE_PADDLE_ENV

  if (!clientToken) {
    showError('Configuration error: Paddle client token not set.')
    return
  }
  if (env !== 'live' && env !== 'sandbox') {
    showError('Configuration error: Paddle environment not set to live or sandbox.')
    return
  }

  try {
    paddle = await initializePaddle({ environment: env, token: clientToken })
  } catch (e) {
    showError('Failed to initialize Paddle: ' + (e as Error).message)
    return
  }

  await loadPrices()
}

// ===== 月/年切换 =====
const toggle = document.getElementById('billing-toggle') as HTMLElement
const lblMonth = document.getElementById('lbl-month') as HTMLElement
const lblYear = document.getElementById('lbl-year') as HTMLElement

toggle.addEventListener('click', () => {
  monthly = !monthly
  toggle.dataset.monthly = String(monthly)
  toggle.setAttribute('aria-checked', String(monthly))
  lblMonth.classList.toggle('active', monthly)
  lblYear.classList.toggle('active', !monthly)
  void loadPrices()
})

init()
