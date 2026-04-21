import type { Config, ExchangeId } from '../types'

// ---------------------------------------------------------------------------
// HMAC-SHA256 via Web Crypto API (browser-native, no external deps)
// ---------------------------------------------------------------------------
async function hmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ---------------------------------------------------------------------------
// All exchange calls go through Vercel Serverless Functions to avoid CORS.
// /api/bingx/* → https://open-api.bingx.com/*
// /api/gate/*  → https://api.gateio.ws/*
// /api/mexc/*  → https://api.mexc.com/*
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// BingX
// ---------------------------------------------------------------------------
export async function fetchBingXBalance(apiKey: string, secret: string): Promise<number> {
  // timestamp gerado por chamada — evita falha por reuso em chamadas sequenciais
  async function bingxFetch(path: string, params: Record<string, string> = {}): Promise<any> {
    const timestamp = Date.now().toString()
    const query = new URLSearchParams({ ...params, timestamp }).toString()
    const signature = await hmacSha256(secret, query)
    const res = await fetch(`/api/bingx${path}?${query}&signature=${signature}`, {
      headers: { 'X-BX-APIKEY': apiKey },
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`BingX HTTP ${res.status}: ${body}`)
    }
    const data = await res.json()
    if (data.code !== 0) throw new Error(`BingX: ${data.msg}`)
    return data
  }

  const spotData = await bingxFetch('/openApi/spot/v1/account/balance')
  let spotUsdt = 0
  if (spotData?.data?.balances) {
    for (const b of spotData.data.balances) {
      if (b.asset === 'USDT') spotUsdt = parseFloat(b.free ?? 0) + parseFloat(b.locked ?? 0)
    }
  }

  let futuresUsdt = 0
  try {
    const futData = await bingxFetch('/openApi/swap/v2/user/balance')
    if (futData?.data?.balance) {
      for (const b of futData.data.balance) {
        if (b.asset === 'USDT') futuresUsdt = parseFloat(b.balance ?? 0)
      }
    }
  } catch { /* futures not critical */ }

  return spotUsdt + futuresUsdt
}

// ---------------------------------------------------------------------------
// Gate.io
// ---------------------------------------------------------------------------
export async function fetchGateBalance(apiKey: string, secret: string): Promise<number> {
  async function gateRequest(method: string, path: string): Promise<any> {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    // SHA-256 of empty body
    const bodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    const signStr = `${method}\n${path}\n\n${bodyHash}\n${timestamp}`
    const signature = await hmacSha256(secret, signStr)
    const res = await fetch(`/api/gate${path}`, {
      method,
      headers: {
        KEY: apiKey,
        Timestamp: timestamp,
        SIGN: signature,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) throw new Error(`Gate.io HTTP ${res.status}`)
    return res.json()
  }

  const spotAccounts: any[] = await gateRequest('GET', '/api/v4/spot/accounts')
  let spotUsdt = 0
  for (const acc of spotAccounts) {
    if (acc.currency === 'USDT') spotUsdt = parseFloat(acc.available ?? 0) + parseFloat(acc.locked ?? 0)
  }

  let futuresUsdt = 0
  try {
    const futAcc = await gateRequest('GET', '/api/v4/futures/usdt/accounts')
    futuresUsdt = parseFloat(futAcc?.total ?? 0)
  } catch { /* futures not critical */ }

  return spotUsdt + futuresUsdt
}

// ---------------------------------------------------------------------------
// MEXC
// ---------------------------------------------------------------------------
export async function fetchMexcBalance(apiKey: string, secret: string): Promise<number> {
  async function mexcRequest(path: string, params: Record<string, string> = {}): Promise<any> {
    const timestamp = Date.now().toString()
    const query = new URLSearchParams({ ...params, timestamp }).toString()
    const signature = await hmacSha256(secret, query)
    const res = await fetch(`/api/mexc${path}?${query}&signature=${signature}`, {
      headers: { 'X-MEXC-APIKEY': apiKey },
    })
    if (!res.ok) throw new Error(`MEXC HTTP ${res.status}`)
    return res.json()
  }

  const spotData = await mexcRequest('/api/v3/account')
  let spotUsdt = 0
  if (spotData?.balances) {
    for (const b of spotData.balances) {
      if (b.asset === 'USDT') spotUsdt = parseFloat(b.free ?? 0) + parseFloat(b.locked ?? 0)
    }
  }

  let futuresUsdt = 0
  try {
    const futData = await mexcRequest('/api/v1/private/account/assets')
    if (futData?.data) {
      for (const b of futData.data) {
        if (b.currency === 'USDT') {
          futuresUsdt = parseFloat(b.positionMargin ?? 0) + parseFloat(b.availableBalance ?? 0)
        }
      }
    }
  } catch { /* futures not critical */ }

  return spotUsdt + futuresUsdt
}

// ---------------------------------------------------------------------------
// Unified fetcher
// ---------------------------------------------------------------------------
type FetchFn = (key: string, secret: string) => Promise<number>

const FETCHERS: Record<ExchangeId, FetchFn> = {
  bingx: fetchBingXBalance,
  gate: fetchGateBalance,
  mexc: fetchMexcBalance,
}

export async function fetchExchangeBalance(id: ExchangeId, config: Config): Promise<number> {
  const cfg = config[id]
  if (!cfg.enabled || !cfg.apiKey || !cfg.secret) throw new Error('Not configured')
  return FETCHERS[id](cfg.apiKey, cfg.secret)
}

export async function fetchAllBalances(config: Config): Promise<{ bingx: number; gate: number; mexc: number }> {
  const [bingx, gate, mexc] = await Promise.allSettled([
    fetchExchangeBalance('bingx', config),
    fetchExchangeBalance('gate', config),
    fetchExchangeBalance('mexc', config),
  ])
  return {
    bingx: bingx.status === 'fulfilled' ? bingx.value : 0,
    gate: gate.status === 'fulfilled' ? gate.value : 0,
    mexc: mexc.status === 'fulfilled' ? mexc.value : 0,
  }
}
