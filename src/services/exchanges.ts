import type { Config, ExchangeId } from '../types'

// ---------------------------------------------------------------------------
// HMAC-SHA256 helper (Web Crypto API — works in browser & service worker)
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
// PROXY base — use local proxy in dev to bypass CORS. In production the user
// must have the proxy running separately. Set VITE_USE_PROXY=true in .env.
// ---------------------------------------------------------------------------
const USE_PROXY = import.meta.env.VITE_USE_PROXY === 'true'

function proxyUrl(base: string, path: string): string {
  if (USE_PROXY) return `/proxy/${encodeURIComponent(base + path)}`
  return base + path
}

// ---------------------------------------------------------------------------
// BingX — https://bingx-api.github.io/docs/
// Spot: GET /openApi/spot/v1/account/balance
// Futures: GET /openApi/swap/v2/user/balance
// ---------------------------------------------------------------------------
export async function fetchBingXBalance(apiKey: string, secret: string): Promise<number> {
  const timestamp = Date.now().toString()

  async function signedFetch(path: string, params: Record<string, string>): Promise<number> {
    const query = new URLSearchParams({ ...params, timestamp }).toString()
    const signature = await hmacSha256(secret, query)
    const url = `https://open-api.bingx.com${path}?${query}&signature=${signature}`
    const res = await fetch(USE_PROXY ? proxyUrl('https://open-api.bingx.com', `${path}?${query}&signature=${signature}`) : url, {
      headers: { 'X-BX-APIKEY': apiKey },
    })
    if (!res.ok) throw new Error(`BingX HTTP ${res.status}`)
    const data = await res.json()
    if (data.code !== 0) throw new Error(`BingX error: ${data.msg}`)
    return data
  }

  // Spot balances
  const spotData = await signedFetch('/openApi/spot/v1/account/balance', {})
  // spotData.data.balances: [{asset, free, locked}]
  let spotUsdt = 0
  if (spotData && (spotData as any).data?.balances) {
    for (const b of (spotData as any).data.balances) {
      if (b.asset === 'USDT') {
        spotUsdt = parseFloat(b.free ?? 0) + parseFloat(b.locked ?? 0)
      }
    }
  }

  // Futures (USDT-M perpetual) balance
  let futuresUsdt = 0
  try {
    const futData = await signedFetch('/openApi/swap/v2/user/balance', {})
    // futData.data.balance: [{asset, balance}]
    if (futData && (futData as any).data?.balance) {
      for (const b of (futData as any).data.balance) {
        if (b.asset === 'USDT') {
          futuresUsdt = parseFloat(b.balance ?? 0)
        }
      }
    }
  } catch {
    // futures balance not critical
  }

  return spotUsdt + futuresUsdt
}

// ---------------------------------------------------------------------------
// Gate.io — https://www.gate.io/docs/developers/apiv4/
// Spot: GET /api/v4/spot/accounts
// Futures: GET /api/v4/futures/usdt/accounts
// ---------------------------------------------------------------------------
export async function fetchGateBalance(apiKey: string, secret: string): Promise<number> {
  const GATE_BASE = 'https://api.gateio.ws'

  async function gateRequest(method: string, path: string): Promise<any> {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const bodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // SHA256 of empty body
    const signStr = `${method}\n${path}\n\n${bodyHash}\n${timestamp}`
    const signature = await hmacSha256(secret, signStr)
    const url = GATE_BASE + path
    const res = await fetch(USE_PROXY ? proxyUrl(GATE_BASE, path) : url, {
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

  // Spot
  const spotAccounts: any[] = await gateRequest('GET', '/api/v4/spot/accounts')
  let spotUsdt = 0
  for (const acc of spotAccounts) {
    if (acc.currency === 'USDT') {
      spotUsdt = parseFloat(acc.available ?? 0) + parseFloat(acc.locked ?? 0)
    }
  }

  // Futures USDT-M
  let futuresUsdt = 0
  try {
    const futAcc = await gateRequest('GET', '/api/v4/futures/usdt/accounts')
    futuresUsdt = parseFloat(futAcc?.total ?? 0)
  } catch {
    // futures balance not critical
  }

  return spotUsdt + futuresUsdt
}

// ---------------------------------------------------------------------------
// MEXC — https://mexcdevelop.github.io/apidocs/spot_v3_en/
// Spot: GET /api/v3/account
// Futures: GET /api/v1/private/account/assets (MEXC futures v1)
// ---------------------------------------------------------------------------
export async function fetchMexcBalance(apiKey: string, secret: string): Promise<number> {
  const MEXC_BASE = 'https://api.mexc.com'

  async function mexcRequest(path: string, params: Record<string, string> = {}): Promise<any> {
    const timestamp = Date.now().toString()
    const query = new URLSearchParams({ ...params, timestamp }).toString()
    const signature = await hmacSha256(secret, query)
    const url = `${MEXC_BASE}${path}?${query}&signature=${signature}`
    const res = await fetch(USE_PROXY ? proxyUrl(MEXC_BASE, `${path}?${query}&signature=${signature}`) : url, {
      headers: { 'X-MEXC-APIKEY': apiKey },
    })
    if (!res.ok) throw new Error(`MEXC HTTP ${res.status}`)
    return res.json()
  }

  // Spot account
  const spotData = await mexcRequest('/api/v3/account')
  let spotUsdt = 0
  if (spotData?.balances) {
    for (const b of spotData.balances) {
      if (b.asset === 'USDT') {
        spotUsdt = parseFloat(b.free ?? 0) + parseFloat(b.locked ?? 0)
      }
    }
  }

  // Futures (contract) account
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
  } catch {
    // futures balance not critical
  }

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

export async function fetchExchangeBalance(
  id: ExchangeId,
  config: Config
): Promise<number> {
  const cfg = config[id]
  if (!cfg.enabled || !cfg.apiKey || !cfg.secret) throw new Error('Not configured')
  return FETCHERS[id](cfg.apiKey, cfg.secret)
}

export async function fetchAllBalances(
  config: Config
): Promise<{ bingx: number; gate: number; mexc: number }> {
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
