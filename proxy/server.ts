/**
 * CORS Proxy Server
 *
 * Some exchanges block direct browser requests due to CORS.
 * This proxy forwards requests from the browser to the exchange APIs.
 *
 * Usage: set VITE_USE_PROXY=true in .env.local and run `npm run proxy`
 *
 * The Vite dev server proxies /proxy/* to this server at port 3001.
 * In production, deploy this proxy alongside the frontend or use a
 * cloud function / Cloudflare Worker instead.
 *
 * Security: This proxy is intended for personal/local use only.
 * Never expose it publicly without authentication.
 */

import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 3001

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }))
app.use(express.json())

// Route: /<encoded-full-url>
// The Vite proxy strips /proxy prefix, so the path here is /<encoded-url>
app.use('/', async (req, res) => {
  try {
    // path starts with /, encoded URL follows
    const encodedUrl = req.path.slice(1)
    if (!encodedUrl) {
      res.status(400).json({ error: 'Missing target URL' })
      return
    }

    const targetUrl = decodeURIComponent(encodedUrl)

    // Safety: only allow known exchange domains
    const ALLOWED_HOSTS = [
      'open-api.bingx.com',
      'api.gateio.ws',
      'api.mexc.com',
    ]
    const url = new URL(targetUrl)
    if (!ALLOWED_HOSTS.includes(url.hostname)) {
      res.status(403).json({ error: `Host ${url.hostname} not allowed` })
      return
    }

    // Forward headers from the original request, minus host
    const forwardHeaders: Record<string, string> = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (['host', 'origin', 'referer'].includes(key.toLowerCase())) continue
      if (typeof value === 'string') forwardHeaders[key] = value
    }

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    })

    res.status(upstream.status)
    upstream.headers.forEach((value, key) => {
      if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, value)
      }
    })

    const body = await upstream.text()
    res.send(body)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`\n🔀 Aura Proxy running at http://localhost:${PORT}`)
  console.log(`   Allowed hosts: BingX, Gate.io, MEXC\n`)
})
