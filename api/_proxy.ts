import type { VercelRequest, VercelResponse } from '@vercel/node'

export async function proxyTo(
  base: string,
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Max-Age', '86400')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  try {
    // O path da corretora vem como query param: ?path=/openApi/spot/v1/...
    const pathParam = req.query.path
    const path = Array.isArray(pathParam) ? pathParam[0] : (pathParam ?? '/')

    // Todos os outros query params (exceto 'path') são repassados à corretora
    const pairs: string[] = []
    for (const [key, val] of Object.entries(req.query)) {
      if (key === 'path') continue
      if (Array.isArray(val)) {
        val.forEach((v) => pairs.push(`${key}=${encodeURIComponent(v)}`))
      } else if (val != null) {
        pairs.push(`${key}=${encodeURIComponent(String(val))}`)
      }
    }
    const qs = pairs.join('&')
    const targetUrl = `${base}${path}${qs ? '?' + qs : ''}`

    const headers: Record<string, string> = {}
    for (const [key, val] of Object.entries(req.headers)) {
      if (
        [
          'host', 'origin', 'referer', 'connection', 'transfer-encoding',
          'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest',
          'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
        ].includes(key.toLowerCase())
      ) continue
      if (typeof val === 'string') headers[key] = val
    }

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: hasBody && req.body ? JSON.stringify(req.body) : undefined,
    })

    upstream.headers.forEach((val, key) => {
      if (['transfer-encoding', 'connection', 'keep-alive', 'content-encoding'].includes(key.toLowerCase())) return
      res.setHeader(key, val)
    })

    return res.status(upstream.status).send(await upstream.text())
  } catch (err: any) {
    console.error('[aura-proxy] error:', err?.message, '| target:', base)
    return res.status(502).json({ error: err?.message ?? 'Proxy error', target: base })
  }
}
