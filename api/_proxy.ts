import type { VercelRequest, VercelResponse } from '@vercel/node'

export async function proxyTo(
  base: string,
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers sempre primeiro — mesmo que a função falhe depois,
  // o browser consegue ler a resposta de erro (sem isso → "Load failed")
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Max-Age', '86400')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  try {
    // Reconstrói o path a partir do catch-all [...path]
    const segments = req.query.path
    const path = segments
      ? '/' + (Array.isArray(segments) ? segments.join('/') : segments)
      : '/'

    // Preserva a query string original do req.url (sem reordenar parâmetros).
    // Crítico para HMAC-SHA256: a assinatura é calculada sobre a string exata.
    const rawUrl = req.url ?? ''
    const qIdx = rawUrl.indexOf('?')
    const qs = qIdx >= 0 ? rawUrl.slice(qIdx + 1) : ''

    const targetUrl = `${base}${path}${qs ? '?' + qs : ''}`

    // Repassa headers, removendo os de nível de conexão
    const headers: Record<string, string> = {}
    for (const [key, val] of Object.entries(req.headers)) {
      if (
        ['host', 'origin', 'referer', 'connection', 'transfer-encoding',
         'sec-fetch-site', 'sec-fetch-mode', 'sec-fetch-dest'].includes(key.toLowerCase())
      ) continue
      if (typeof val === 'string') headers[key] = val
    }

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: hasBody && req.body ? JSON.stringify(req.body) : undefined,
    })

    // Repassa headers da resposta, exceto hop-by-hop
    upstream.headers.forEach((val, key) => {
      if (['transfer-encoding', 'connection', 'keep-alive', 'content-encoding'].includes(key.toLowerCase())) return
      res.setHeader(key, val)
    })

    return res.status(upstream.status).send(await upstream.text())
  } catch (err: any) {
    console.error('[proxy] error:', err)
    return res.status(502).json({
      error: err?.message ?? 'Proxy error',
      target: base,
    })
  }
}
