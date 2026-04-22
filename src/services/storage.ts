import type { Config, DayRecord, Operation, RefreshInterval, Snapshot, SnapshotRecord } from '../types'

const KEYS = {
  config: 'aura_config',
  history: 'aura_history',
  operations: 'aura_operations',
  refreshInterval: 'aura_refresh_interval',
  baseSnapshot: 'aura_base_snapshot',
  snapshotHistory: 'aura_snapshot_history',
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

export function getBaseSnapshot(): Snapshot | null {
  try {
    const raw = localStorage.getItem(KEYS.baseSnapshot)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveBaseSnapshot(s: Snapshot): void {
  localStorage.setItem(KEYS.baseSnapshot, JSON.stringify(s))
}

export function clearBaseSnapshot(): void {
  localStorage.removeItem(KEYS.baseSnapshot)
}

export function getSnapshotHistory(): SnapshotRecord[] {
  try {
    const raw = localStorage.getItem(KEYS.snapshotHistory)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addSnapshotRecord(record: SnapshotRecord): void {
  const history = getSnapshotHistory()
  history.push(record)
  localStorage.setItem(KEYS.snapshotHistory, JSON.stringify(history))
}

export function clearAllData(): void {
  localStorage.removeItem(KEYS.config)
  localStorage.removeItem(KEYS.history)
  localStorage.removeItem(KEYS.operations)
  localStorage.removeItem(KEYS.baseSnapshot)
  localStorage.removeItem(KEYS.snapshotHistory)
}

