import type { Config, DayRecord } from '../types'

const KEYS = {
  config: 'aura_config',
  history: 'aura_history',
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

export function clearAllData(): void {
  localStorage.removeItem(KEYS.config)
  localStorage.removeItem(KEYS.history)
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
