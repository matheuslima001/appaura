export interface ExchangeConfig {
  apiKey: string
  secret: string
  enabled: boolean
}

export interface Config {
  bingx: ExchangeConfig
  gate: ExchangeConfig
  mexc: ExchangeConfig
}

export interface BalanceBreakdown {
  bingx: number
  gate: number
  mexc: number
  total: number
}

export interface DayRecord {
  date: string // "YYYY-MM-DD"
  startBalance: BalanceBreakdown
  endBalance?: BalanceBreakdown
  profitUSDT?: number
  profitBRL?: number
  profitPct?: number
  usdBrlRate: number
  closed: boolean
}

export type ExchangeId = 'bingx' | 'gate' | 'mexc'

export interface ExchangeStatus {
  id: ExchangeId
  name: string
  balance: number | null
  loading: boolean
  error: string | null
}

export interface Operation {
  id: string
  pair: string
  exchange: ExchangeId
  type: 'SPOT' | 'FUTURES'
  side: 'LONG' | 'SHORT'
  entryPrice: number
  currentPrice: number
  qty: number
  openedAt: string
  closedAt?: string
  exitPrice?: number
  status: 'open' | 'closed'
}

export type RefreshInterval = 20 | 60 | 120 | 240

export interface Snapshot {
  balance: number
  timestamp: string  // ISO string
  usdBrlRate: number
}

export interface SnapshotRecord {
  id: string
  startSnapshot: Snapshot
  endSnapshot: Snapshot
  profitUSDT: number
  profitBRL: number
  profitPct: number
}
