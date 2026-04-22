import type { Config, ExchangeId } from '../types'

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
// BingX  →  /api/bingx-proxy?path=<exchange-path>&<query-params>
// ---------------------------------------------------------------------------
export async function fetchBingXBalance(apiKey: string, secret: string): Promise<number> {
  async function bingxFetch(exchangePath: string): Promise<any> {
    const timestamp = Date.now().toString()
    const query = new URLSearchParams({ timestamp }).toString()
    const signature = await hmacSha256(secret, query)
    const url = `/api/bingx-proxy?path=${encodeURIComponent(exchangePath)}&${query}&signature=${signature}`
    const res = await fetch(url, { headers: { 'X-BX-APIKEY': apiKey } })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`BingX HTTP ${res.status}: ${body}`)
    }
    const data = await res.json()
    if (data.code !== 0) throw new Error(`BingX erro ${data.code}: ${data.msg}`)
    return data
  }

  // Spot: data.balances é array — { asset, free, locked }
  // parseFloat lida com notação científica como "1.5e-9"
  let spotUsdt = 0
  const spotData = await bingxFetch('/openApi/spot/v1/account/balance')
  if (Array.isArray(spotData?.data?.balances)) {
    for (const b of spotData.data.balances) {
      if (b.asset === 'USDT') {
        spotUsdt = parseFloat(b.free ?? '0') + parseFloat(b.locked ?? '0')
        break
      }
    }
  }

  // Futuros: data.balance é objeto — { asset, balance, equity }
  // Usa balance (saldo total), não equity (inclui PnL não realizado)
  let futuresUsdt = 0
  try {
    const futData = await bingxFetch('/openApi/swap/v2/user/balance')
    const bal = futData?.data?.balance
    if (bal && typeof bal === 'object') {
      futuresUsdt = parseFloat(bal.balance ?? '0')
    }
  } catch (err: any) {
    // Não crítico: conta pode não ter futuros habilitado
    console.warn('[BingX futures]', err?.message)
  }

  return spotUsdt + futuresUsdt
}

// ---------------------------------------------------------------------------
// Gate.io  →  /api/gate-proxy?path=<exchange-path>  (auth via headers)
// Gate.io v4 usa HMAC-SHA512 e timestamp em segundos
// ---------------------------------------------------------------------------
async function hmacSha512(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function fetchGateBalance(apiKey: string, secret: string): Promise<number> {
  async function gateRequest(method: string, exchangePath: string): Promise<any> {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    // SHA-256 do body vazio (requisição GET sem body)
    const bodyHash = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e'
    // String de assinatura: METHOD\nPATH\nQUERY_STRING\nBODY_HASH\nTIMESTAMP
    const signStr = `${method}\n${exchangePath}\n\n${bodyHash}\n${timestamp}`
    const signature = await hmacSha512(secret, signStr)
    const url = `/api/gate-proxy?path=${encodeURIComponent(exchangePath)}`
    const res = await fetch(url, {
      method,
      headers: {
        KEY: apiKey,
        SIGN: signature,
        Timestamp: timestamp,
      },
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Gate.io HTTP ${res.status}: ${body}`)
    }
    return res.json()
  }

  // Spot: GET /api/v4/spot/accounts → filtra currency === "USDT"
  const spotAccounts: any[] = await gateRequest('GET', '/api/v4/spot/accounts')
  let spotUsdt = 0
  for (const acc of spotAccounts) {
    if (acc.currency === 'USDT') {
      spotUsdt = parseFloat(acc.available ?? '0') + parseFloat(acc.locked ?? '0')
      break
    }
  }

  // Futuros: GET /futures/usdt/accounts → campo total
  let futuresUsdt = 0
  try {
    const futAcc = await gateRequest('GET', '/futures/usdt/accounts')
    futuresUsdt = parseFloat(futAcc?.total ?? '0')
  } catch (err: any) {
    console.warn('[Gate.io futures]', err?.message)
  }

  return spotUsdt + futuresUsdt
}

// ---------------------------------------------------------------------------
// MEXC  →  /api/mexc-proxy?path=<exchange-path>&<query-params>
// ---------------------------------------------------------------------------
export async function fetchMexcBalance(apiKey: string, secret: string): Promise<number> {
  async function mexcRequest(exchangePath: string, params: Record<string, string> = {}): Promise<any> {
    const timestamp = Date.now().toString()
    const query = new URLSearchParams({ ...params, timestamp }).toString()
    const signature = await hmacSha256(secret, query)
    const url = `/api/mexc-proxy?path=${encodeURIComponent(exchangePath)}&${query}&signature=${signature}`
    const res = await fetch(url, { headers: { 'X-MEXC-APIKEY': apiKey } })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`MEXC HTTP ${res.status}: ${body}`)
    }
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
