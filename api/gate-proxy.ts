import type { VercelRequest, VercelResponse } from '@vercel/node'

const BASE = 'https://api.gateio.ws'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')

  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const pathParam = req.query.path
    const path = Array.isArray(pathParam) ? pathParam[0] : (pathParam ?? '/')

    const pairs: string[] = []
    for (const [key, val] of Object.entries(req.query)) {
      if (key === 'path') continue
      if (Array.isArray(val)) val.forEach((v) => pairs.push(`${key}=${encodeURIComponent(v)}`))
      else if (val != null) pairs.push(`${key}=${encodeURIComponent(String(val))}`)
    }
    const targetUrl = `${BASE}${path}${pairs.length ? '?' + pairs.join('&') : ''}`

    const headers: Record<string, string> = {}
    const skip = ['host','origin','referer','connection','transfer-encoding',
      'sec-fetch-site','sec-fetch-mode','sec-fetch-dest','sec-ch-ua','sec-ch-ua-mobile','sec-ch-ua-platform']
    for (const [key, val] of Object.entries(req.headers)) {
      if (skip.includes(key.toLowerCase())) continue
      if (typeof val === 'string') headers[key] = val
    }

    const upstream = await fetch(targetUrl, { method: req.method, headers })

    upstream.headers.forEach((val, key) => {
      if (['transfer-encoding','connection','keep-alive','content-encoding'].includes(key.toLowerCase())) return
      res.setHeader(key, val)
    })
    return res.status(upstream.status).send(await upstream.text())
  } catch (err: any) {
    console.error('[gate-proxy]', err?.message)
    return res.status(502).json({ error: err?.message ?? 'Proxy error' })
  }
}
