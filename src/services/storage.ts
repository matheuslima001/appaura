import type { Config, DayRecord, Operation, RefreshInterval } from '../types'

const KEYS = {
  config: 'aura_config',
  history: 'aura_history',
  operations: 'aura_operations',
  refreshInterval: 'aura_refresh_interval',
}

const DEFAULT_CONFIG: Config = {
  bingx: { apiKey: '', secret: '', enabled: false },
  gate: { apiKey: '', secret: '', enabled: false },
  mexc: { apiKey: '', secret: '', enabled: false },
}

export function getConfig(): Config {
  try {
    const raw = localStorage.getItem(KEYS.config)
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG
  } catch {
    return DEFAULT_CONFIG
  }
}

export function saveConfig(config: Config): void {
  localStorage.setItem(KEYS.config, JSON.stringify(config))
}

export function getHistory(): DayRecord[] {
  try {
    const raw = localStorage.getItem(KEYS.history)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveHistory(records: DayRecord[]): void {
  localStorage.setItem(KEYS.history, JSON.stringify(records))
}

export function upsertDayRecord(record: DayRecord): void {
  const history = getHistory()
  const idx = history.findIndex((r) => r.date === record.date)
  if (idx >= 0) {
    history[idx] = record
  } else {
    history.push(record)
  }
  saveHistory(history)
}

export function getDayRecord(date: string): DayRecord | undefined {
  return getHistory().find((r) => r.date === date)
}

export function getOperations(): Operation[] {
  try {
    const raw = localStorage.getItem(KEYS.operations)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveOperations(ops: Operation[]): void {
  localStorage.setItem(KEYS.operations, JSON.stringify(ops))
}

export function upsertOperation(op: Operation): void {
  const ops = getOperations()
  const idx = ops.findIndex((o) => o.id === op.id)
  if (idx >= 0) ops[idx] = op
  else ops.push(op)
  saveOperations(ops)
}

export function deleteOperation(id: string): void {
  saveOperations(getOperations().filter((o) => o.id !== id))
}

export function getRefreshInterval(): RefreshInterval {
  try {
    const raw = localStorage.getItem(KEYS.refreshInterval)
    const val = raw ? parseInt(raw) : 60
    return ([20, 60, 120, 240].includes(val) ? val : 60) as RefreshInterval
  } catch {
    return 60
  }
}

export function saveRefreshInterval(interval: RefreshInterval): void {
  localStorage.setItem(KEYS.refreshInterval, String(interval))
}

export function clearAllData(): void {
  localStorage.removeItem(KEYS.config)
  localStorage.removeItem(KEYS.history)
  localStorage.removeItem(KEYS.operations)
}

export function exportCSV(records: DayRecord[]): void {
  const header = 'Data,Banca Inicial (USDT),Banca Final (USDT),Lucro USDT,Lucro BRL,Lucro %,Cotação USD/BRL'
  const rows = records
    .filter((r) => r.closed)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) =>
      [
        r.date,
        r.startBalance.total.toFixed(2),
        r.endBalance?.total.toFixed(2) ?? '',
        r.profitUSDT?.toFixed(2) ?? '',
        r.profitBRL?.toFixed(2) ?? '',
        r.profitPct?.toFixed(4) ?? '',
        r.usdBrlRate.toFixed(4),
      ].join(',')
    )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `aura_historico_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
