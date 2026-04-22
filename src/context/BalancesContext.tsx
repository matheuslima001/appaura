import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { getConfig, getRefreshInterval } from '../services/storage'
import { fetchAllBalances } from '../services/exchanges'
import { getUsdBrlRate } from '../services/rates'
import type { ExchangeStatus } from '../types'

interface BalancesContextValue {
  exchanges: ExchangeStatus[]
  totalBalance: number
  usdBrl: number
  loading: boolean
  lastUpdate: Date | null
  refresh: () => Promise<void>
}

const BalancesContext = createContext<BalancesContextValue | null>(null)

export function BalancesProvider({ children }: { children: ReactNode }) {
  const [exchanges, setExchanges] = useState<ExchangeStatus[]>([
    { id: 'bingx', name: 'BingX', balance: null, loading: false, error: null },
    { id: 'gate', name: 'Gate.io', balance: null, loading: false, error: null },
    { id: 'mexc', name: 'MEXC', balance: null, loading: false, error: null },
  ])
  const [usdBrl, setUsdBrl] = useState(5.0)
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    const config = getConfig()
    setLoading(true)
    setExchanges((prev) => prev.map((e) => ({ ...e, loading: true, error: null })))
    try {
      const [rate, balances] = await Promise.all([getUsdBrlRate(), fetchAllBalances(config)])
      setUsdBrl(rate)
      setExchanges((prev) =>
        prev.map((e) => {
          const key = e.id as keyof typeof balances
          const cfg = config[key]
          if (!cfg.enabled) return { ...e, loading: false, balance: null, error: null }
          return { ...e, loading: false, balance: balances[key], error: null }
        })
      )
      setLastUpdate(new Date())
    } catch {
      setExchanges((prev) => prev.map((e) => ({ ...e, loading: false })))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    getUsdBrlRate().then(setUsdBrl)
    refresh()
  }, [])

  useEffect(() => {
    function startTimer() {
      if (timerRef.current) clearInterval(timerRef.current)
      const interval = getRefreshInterval()
      timerRef.current = setInterval(refresh, interval * 1000)
    }
    startTimer()

    function handleStorage(e: StorageEvent) {
      if (e.key === 'aura_refresh_interval') startTimer()
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      window.removeEventListener('storage', handleStorage)
    }
  }, [refresh])

  const totalBalance = exchanges.reduce((s, e) => s + (e.balance ?? 0), 0)

  return (
    <BalancesContext.Provider value={{ exchanges, totalBalance, usdBrl, loading, lastUpdate, refresh }}>
      {children}
    </BalancesContext.Provider>
  )
}

export function useBalances() {
  const ctx = useContext(BalancesContext)
  if (!ctx) throw new Error('useBalances must be used inside BalancesProvider')
  return ctx
}
