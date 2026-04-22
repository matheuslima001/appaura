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
  async function gateRequest(method: string, exchangePath: string, queryString = ''): Promise<any> {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const bodyHash = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e'
    const signStr = `${method}\n${exchangePath}\n${queryString}\n${bodyHash}\n${timestamp}`
    const signature = await hmacSha512(secret, signStr)
    const fullPath = queryString ? `${exchangePath}?${queryString}` : exchangePath
    const url = `/api/gate-proxy?path=${encodeURIComponent(fullPath)}`
    const res = await fetch(url, {
      method,
      headers: { KEY: apiKey, SIGN: signature, Timestamp: timestamp },
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Gate.io HTTP ${res.status}: ${body}`)
    }
    return res.json()
  }

  // Spot: busca todos os saldos e converte cada moeda para USDT
  const spotAccounts: any[] = await gateRequest('GET', '/api/v4/spot/accounts')

  // Coleta moedas com saldo > 0
  const nonZero = spotAccounts.filter((a) => {
    const total = parseFloat(a.available ?? '0') + parseFloat(a.locked ?? '0')
    return total > 0
  })

  let spotUsdt = 0
  await Promise.all(
    nonZero.map(async (acc) => {
      const amount = parseFloat(acc.available ?? '0') + parseFloat(acc.locked ?? '0')
      if (acc.currency === 'USDT') {
        spotUsdt += amount
        return
      }
      // Converte para USDT via ticker
      try {
        const pair = `${acc.currency}_USDT`
        const tickers = await gateRequest('GET', '/api/v4/spot/tickers', `currency_pair=${pair}`)
        const price = parseFloat(tickers?.[0]?.last ?? '0')
        if (price > 0) spotUsdt += amount * price
      } catch {
        // Par sem mercado USDT — ignora
      }
    })
  )

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
// MEXC Spot  →  /api/mexc-proxy         (api.mexc.com)
// MEXC Futuros → /api/mexc-futures-proxy (contract.mexc.com)
// ---------------------------------------------------------------------------
export async function fetchMexcBalance(apiKey: string, secret: string): Promise<number> {
  async function mexcRequest(exchangePath: string): Promise<any> {
    const timestamp = Date.now().toString()
    const query = new URLSearchParams({ timestamp }).toString()
    const signature = await hmacSha256(secret, query)
    const url = `/api/mexc-proxy?path=${encodeURIComponent(exchangePath)}&${query}&signature=${signature}`
    const res = await fetch(url, { headers: { 'X-MEXC-APIKEY': apiKey } })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`MEXC HTTP ${res.status}: ${body}`)
    }
    return res.json()
  }

  // GET /api/v3/account → balances[{ asset, free, locked }]
  // Retorna saldo spot; futuros MEXC ficam em conta separada não acessível por esta chave
  const data = await mexcRequest('/api/v3/account')
  let usdt = 0
  if (Array.isArray(data?.balances)) {
    for (const b of data.balances) {
      if (b.asset === 'USDT') {
        usdt = parseFloat(b.free ?? '0') + parseFloat(b.locked ?? '0')
        break
      }
    }
  }
  return usdt
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
