import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const apiKey = req.headers['x-api-key'] as string
  const secret = req.headers['x-secret'] as string

  if (!apiKey || !secret) {
    return res.status(400).json({ error: 'Faltam headers x-api-key e x-secret' })
  }

  const timestamp = Date.now().toString()

  async function mexcGet(baseUrl: string, path: string) {
    const params = `timestamp=${timestamp}`
    const signature = crypto.createHmac('sha256', secret).update(params).digest('hex')
    const url = `${baseUrl}${path}?${params}&signature=${signature}`
    try {
      const r = await fetch(url, { headers: { 'X-MEXC-APIKEY': apiKey } })
      const text = await r.text()
      return { status: r.status, body: text.slice(0, 500) }
    } catch (e: any) {
      return { error: e.message }
    }
  }

  const results = await Promise.allSettled([
    mexcGet('https://api.mexc.com', '/api/v3/account').then(r => ({ endpoint: 'spot/account', ...r })),
    mexcGet('https://contract.mexc.com', '/api/v1/private/account/assets').then(r => ({ endpoint: 'futures/assets', ...r })),
    mexcGet('https://contract.mexc.com', '/api/v1/private/account/asset/USDT').then(r => ({ endpoint: 'futures/asset/USDT', ...r })),
    mexcGet('https://futures.mexc.com', '/api/v1/private/account/assets').then(r => ({ endpoint: 'futures2/assets', ...r })),
  ])

  return res.status(200).json(results.map(r => r.status === 'fulfilled' ? r.value : r.reason))
}
