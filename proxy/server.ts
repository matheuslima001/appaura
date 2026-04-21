/**
 * Proxy local para desenvolvimento.
 * Espelha as rotas das Vercel Serverless Functions:
 *   /api/bingx/* → https://open-api.bingx.com/*
 *   /api/gate/*  → https://api.gateio.ws/*
 *   /api/mexc/*  → https://api.mexc.com/*
 *
 * Uso: npm run proxy  (ou npm run dev:all para subir tudo junto)
 */

import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 3001

const ROUTES: Record<string, string> = {
  '/api/bingx': 'https://open-api.bingx.com',
  '/api/gate':  'https://api.gateio.ws',
  '/api/mexc':  'https://api.mexc.com',
}

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }))
app.use(express.json())

for (const [prefix, base] of Object.entries(ROUTES)) {
  app.use(prefix, async (req, res) => {
    try {
      const targetUrl = base + req.path + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '')

      const headers: Record<string, string> = {}
      for (const [key, val] of Object.entries(req.headers)) {
        if (['host', 'origin', 'referer', 'connection'].includes(key.toLowerCase())) continue
        if (typeof val === 'string') headers[key] = val
      }

      const upstream = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
      })

      res.status(upstream.status)
      upstream.headers.forEach((val, key) => {
        if (['transfer-encoding', 'connection'].includes(key.toLowerCase())) return
        res.setHeader(key, val)
      })
      res.send(await upstream.text())
    } catch (err: any) {
      res.status(502).json({ error: err.message })
    }
  })
}

app.listen(PORT, () => {
  console.log(`\n🔀 Aura Dev Proxy  →  http://localhost:${PORT}`)
  console.log('   /api/bingx → BingX')
  console.log('   /api/gate  → Gate.io')
  console.log('   /api/mexc  → MEXC\n')
})
