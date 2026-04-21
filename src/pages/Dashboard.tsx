import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { RefreshCw, Play, StopCircle, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import ExchangeCard from '../components/ExchangeCard'
import Spinner from '../components/Spinner'
import { getConfig, getDayRecord, upsertDayRecord } from '../services/storage'
import { fetchAllBalances } from '../services/exchanges'
import { getUsdBrlRate } from '../services/rates'
import { formatUSDT, formatBRL, formatPct, formatDate, todayStr, formatTime } from '../utils/format'
import type { DayRecord, ExchangeStatus } from '../types'

export default function Dashboard() {
  const today = todayStr()
  const [dayRecord, setDayRecord] = useState<DayRecord | undefined>(() => getDayRecord(today))
  const [usdBrl, setUsdBrl] = useState<number>(5.0)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [globalLoading, setGlobalLoading] = useState(false)
  const [exchanges, setExchanges] = useState<ExchangeStatus[]>([
    { id: 'bingx', name: 'BingX', balance: null, loading: false, error: null },
    { id: 'gate', name: 'Gate.io', balance: null, loading: false, error: null },
    { id: 'mexc', name: 'MEXC', balance: null, loading: false, error: null },
  ])

  const config = getConfig()

  const totalBalance = exchanges.reduce((s, e) => s + (e.balance ?? 0), 0)

  const refreshBalances = useCallback(async () => {
    setGlobalLoading(true)
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
      toast.success('Saldos atualizados')
    } catch (err: any) {
      toast.error('Erro ao atualizar saldos')
      setExchanges((prev) => prev.map((e) => ({ ...e, loading: false, error: e.loading ? 'Erro de conexão' : e.error })))
    } finally {
      setGlobalLoading(false)
    }
  }, [])

  useEffect(() => {
    // load cached rate on mount
    getUsdBrlRate().then(setUsdBrl)
  }, [])

  async function handleStartDay() {
    if (dayRecord) {
      toast.error('Dia já iniciado')
      return
    }
    setGlobalLoading(true)
    try {
      const [rate, balances] = await Promise.all([getUsdBrlRate(), fetchAllBalances(config)])
      setUsdBrl(rate)
      const record: DayRecord = {
        date: today,
        startBalance: {
          bingx: balances.bingx,
          gate: balances.gate,
          mexc: balances.mexc,
          total: balances.bingx + balances.gate + balances.mexc,
        },
        usdBrlRate: rate,
        closed: false,
      }
      upsertDayRecord(record)
      setDayRecord(record)
      setExchanges((prev) =>
        prev.map((e) => ({
          ...e,
          balance: balances[e.id as keyof typeof balances],
          loading: false,
          error: null,
        }))
      )
      setLastUpdate(new Date())
      toast.success('Dia iniciado!')
    } catch {
      toast.error('Erro ao buscar saldos')
    } finally {
      setGlobalLoading(false)
    }
  }

  async function handleCloseDay() {
    if (!dayRecord) {
      toast.error('Inicie o dia primeiro')
      return
    }
    if (dayRecord.closed) {
      toast.error('Dia já fechado')
      return
    }
    setGlobalLoading(true)
    try {
      const [rate, balances] = await Promise.all([getUsdBrlRate(), fetchAllBalances(config)])
      const endTotal = balances.bingx + balances.gate + balances.mexc
      const profitUSDT = endTotal - dayRecord.startBalance.total
      const profitBRL = profitUSDT * rate
      const profitPct = dayRecord.startBalance.total > 0 ? (profitUSDT / dayRecord.startBalance.total) * 100 : 0
      const updated: DayRecord = {
        ...dayRecord,
        endBalance: { ...balances, total: endTotal },
        profitUSDT,
        profitBRL,
        profitPct,
        usdBrlRate: rate,
        closed: true,
      }
      upsertDayRecord(updated)
      setDayRecord(updated)
      setUsdBrl(rate)
      setExchanges((prev) =>
        prev.map((e) => ({ ...e, balance: balances[e.id as keyof typeof balances], loading: false, error: null }))
      )
      setLastUpdate(new Date())
      toast.success('Dia fechado com sucesso!')
    } catch {
      toast.error('Erro ao fechar o dia')
    } finally {
      setGlobalLoading(false)
    }
  }

  const profit = dayRecord?.closed
    ? { usdt: dayRecord.profitUSDT ?? 0, brl: dayRecord.profitBRL ?? 0, pct: dayRecord.profitPct ?? 0 }
    : dayRecord
    ? {
        usdt: totalBalance - dayRecord.startBalance.total,
        brl: (totalBalance - dayRecord.startBalance.total) * usdBrl,
        pct:
          dayRecord.startBalance.total > 0
            ? ((totalBalance - dayRecord.startBalance.total) / dayRecord.startBalance.total) * 100
            : 0,
      }
    : null

  const profitPositive = profit ? profit.usdt >= 0 : null

  return (
    <div className="flex-1 px-4 pt-6 pb-28 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest">Dashboard</p>
          <h1 className="text-xl font-bold text-white">{formatDate(today)}</h1>
        </div>
        {lastUpdate && (
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Clock size={12} />
            {formatTime(lastUpdate)}
          </div>
        )}
      </div>

      {/* Total Balance Card */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-600/30 to-indigo-800/20 border border-violet-500/30 p-5">
        <p className="text-xs text-violet-300 uppercase tracking-wider mb-1">Saldo Total</p>
        <div className="flex items-end gap-3">
          {globalLoading ? (
            <Spinner size={28} />
          ) : (
            <>
              <span className="text-3xl font-bold text-white">{formatUSDT(totalBalance)}</span>
              <span className="text-slate-400 mb-0.5">USDT</span>
            </>
          )}
        </div>
        <p className="text-sm text-slate-400 mt-1">{formatBRL(totalBalance * usdBrl)}</p>
        {dayRecord && (
          <p className="text-xs text-slate-500 mt-2">
            Banca inicial: {formatUSDT(dayRecord.startBalance.total)} USDT
          </p>
        )}
      </div>

      {/* Profit Card */}
      {profit !== null && (
        <div className={`rounded-2xl border p-5 ${profitPositive ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="flex items-center gap-2 mb-2">
            {profitPositive ? <TrendingUp size={18} className="text-emerald-400" /> : <TrendingDown size={18} className="text-red-400" />}
            <p className={`text-xs uppercase tracking-wider ${profitPositive ? 'text-emerald-300' : 'text-red-300'}`}>
              Lucro do Dia {dayRecord?.closed && <span className="ml-1 bg-slate-700 px-1.5 py-0.5 rounded-full text-slate-400">Fechado</span>}
            </p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${profitPositive ? 'text-emerald-300' : 'text-red-300'}`}>
              {formatPct(profit.pct)}
            </span>
            <span className={`text-sm ${profitPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {profit.usdt >= 0 ? '+' : ''}{formatUSDT(profit.usdt)} USDT
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">{formatBRL(profit.brl)}</p>
        </div>
      )}

      {/* Exchange Cards */}
      <div className="grid grid-cols-1 gap-3">
        {exchanges.map((ex) => (
          <ExchangeCard
            key={ex.id}
            name={ex.name}
            balance={ex.balance}
            loading={ex.loading}
            error={ex.error}
            enabled={config[ex.id].enabled}
          />
        ))}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 pt-2">
        {!dayRecord && (
          <button
            onClick={handleStartDay}
            disabled={globalLoading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold transition-colors"
          >
            {globalLoading ? <Spinner size={18} /> : <Play size={18} />}
            Iniciar Dia
          </button>
        )}
        {dayRecord && !dayRecord.closed && (
          <>
            <button
              onClick={refreshBalances}
              disabled={globalLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-semibold transition-colors"
            >
              {globalLoading ? <Spinner size={18} /> : <RefreshCw size={18} />}
              Atualizar Saldos
            </button>
            <button
              onClick={handleCloseDay}
              disabled={globalLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold transition-colors"
            >
              {globalLoading ? <Spinner size={18} /> : <StopCircle size={18} />}
              Fechar Dia
            </button>
          </>
        )}
        {dayRecord?.closed && (
          <button
            onClick={refreshBalances}
            disabled={globalLoading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-semibold transition-colors"
          >
            {globalLoading ? <Spinner size={18} /> : <RefreshCw size={18} />}
            Atualizar Saldos
          </button>
        )}
      </div>

      {/* Cotação */}
      <p className="text-center text-xs text-slate-600 pb-2">
        USD/BRL: R$ {usdBrl.toFixed(4)}
      </p>
    </div>
  )
}
