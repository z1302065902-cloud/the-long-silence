/**
 * 国家检测端点（Vercel 边缘函数）。
 *
 * Vercel 在请求头 `x-vercel-ip-country` 提供访客国家（ISO 3166-1 alpha-2）。
 * 缺失时返回空 country，前端不传给 Paddle（让 Paddle 自动检测 IP）。
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  // 只取合法的 2 字母国家码，避免脏数据
  const raw = (req.headers['x-vercel-ip-country'] as string) || ''
  const country = /^[A-Z]{2}$/.test(raw) ? raw : undefined
  res.setHeader('Cache-Control', 'public, max-age=300')
  return res.status(200).json({ country: country ?? null })
}
