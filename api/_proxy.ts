import type { VercelRequest, VercelResponse } from '@vercel/node'

export async function proxyTo(
  base: string,
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    // path segments from catch-all [...path]
    const segments = req.query.path
    const path = segments
      ? '/' + (Array.isArray(segments) ? segments.join('/') : segments)
      : '/'

    // rebuild query string, excluding the catch-all 'path' key
    const qs = new URLSearchParams()
    for (const [key, val] of Object.entries(req.query)) {
      if (key === 'path') continue
      if (Array.isArray(val)) val.forEach((v) => qs.append(key, v))
      else if (val) qs.append(key, val)
    }

    const targetUrl = `${base}${path}${qs.toString() ? '?' + qs.toString() : ''}`

    // forward headers, strip connection-level ones
    const headers: Record<string, string> = {}
    for (const [key, val] of Object.entries(req.headers)) {
      if (['host', 'origin', 'referer', 'connection', 'transfer-encoding'].includes(key.toLowerCase())) continue
      if (typeof val === 'string') headers[key] = val
    }

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    const body = hasBody && req.body ? JSON.stringify(req.body) : undefined

    const upstream = await fetch(targetUrl, { method: req.method, headers, body })

    // forward response headers (skip hop-by-hop)
    upstream.headers.forEach((val, key) => {
      if (['transfer-encoding', 'connection', 'keep-alive'].includes(key.toLowerCase())) return
      res.setHeader(key, val)
    })

    res.status(upstream.status).send(await upstream.text())
  } catch (err: any) {
    res.status(502).json({ error: err.message ?? 'Proxy error' })
  }
}
