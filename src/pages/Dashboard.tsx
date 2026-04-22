import { useState } from 'react'
import toast from 'react-hot-toast'
import { RefreshCw, Play, StopCircle, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import Spinner from '../components/Spinner'
import { getConfig, getDayRecord, upsertDayRecord, getHistory, getOperations } from '../services/storage'
import { fetchAllBalances } from '../services/exchanges'
import { getUsdBrlRate } from '../services/rates'
import { useBalances } from '../context/BalancesContext'
import { formatUSDT, formatBRL, formatPct, formatDate, todayStr, formatTime } from '../utils/format'
import type { DayRecord } from '../types'

function pnlForPeriod(days: number, history: DayRecord[]) {
  const closed = history.filter((r) => r.closed && r.profitUSDT !== undefined)
  if (days === 0) return closed.reduce((s, r) => s + (r.profitUSDT ?? 0), 0)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  return closed.filter((r) => r.date >= cutoffStr).reduce((s, r) => s + (r.profitUSDT ?? 0), 0)
}

function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

export default function Dashboard() {
  const today = todayStr()
  const yesterday = yesterdayStr()
  const { totalBalance, usdBrl, loading: ctxLoading, lastUpdate, refresh } = useBalances()
  const [dayRecord, setDayRecord] = useState<DayRecord | undefined>(() => getDayRecord(today))
  const [actionLoading, setActionLoading] = useState(false)

  const loading = ctxLoading || actionLoading
  const config = getConfig()
  const history = getHistory()
  const operations = getOperations()
  const openOps = operations.filter((o) => o.status === 'open')
  const inPositions = openOps.reduce((s, o) => s + o.entryPrice * o.qty, 0)
  const available = totalBalance - inPositions

  const todayRecord = getDayRecord(today)
  const yesterdayRecord = getDayRecord(yesterday)

  const todayPnl = todayRecord?.closed
    ? todayRecord.profitUSDT ?? 0
    : todayRecord
    ? totalBalance - todayRecord.startBalance.total
    : 0

  const yesterdayPnl = yesterdayRecord?.profitUSDT ?? 0
  const pnl7d = pnlForPeriod(7, history)
  const pnl30d = pnlForPeriod(30, history)

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

  async function handleStartDay() {
    if (dayRecord) { toast.error('Dia já iniciado'); return }
    setActionLoading(true)
    try {
      const [rate, balances] = await Promise.all([getUsdBrlRate(), fetchAllBalances(config)])
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
      await refresh()
      toast.success('Dia iniciado!')
    } catch {
      toast.error('Erro ao buscar saldos')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCloseDay() {
    if (!dayRecord) { toast.error('Inicie o dia primeiro'); return }
    if (dayRecord.closed) { toast.error('Dia já fechado'); return }
    setActionLoading(true)
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
      await refresh()
      toast.success('Dia fechado com sucesso!')
    } catch {
      toast.error('Erro ao fechar o dia')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRefresh() {
    await refresh()
    toast.success('Saldos atualizados')
  }

  const PnlPill = ({ label, value }: { label: string; value: number }) => {
    const pos = value >= 0
    return (
      <div className="flex-1 rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-sm font-semibold ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
          {value >= 0 ? '+' : ''}{formatUSDT(value)}
        </p>
        <p className="text-[10px] text-slate-500">{formatBRL(value * usdBrl)}</p>
      </div>
    )
  }

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

      {/* Total Balance */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-600/30 to-indigo-800/20 border border-violet-500/30 p-5">
        <p className="text-xs text-violet-300 uppercase tracking-wider mb-1">Saldo Total</p>
        <div className="flex items-end gap-3">
          {loading ? (
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
            Abertura: {formatUSDT(dayRecord.startBalance.total)} USDT
          </p>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Disponível</p>
          <p className="text-sm font-semibold text-white">{formatUSDT(available)}</p>
        </div>
        <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Em Posições</p>
          <p className="text-sm font-semibold text-amber-400">{formatUSDT(inPositions)}</p>
        </div>
        <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Ops Abertas</p>
          <p className="text-sm font-semibold text-white">{openOps.length}</p>
        </div>
      </div>

      {/* PnL by period */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">PnL por Período</p>
        <div className="flex gap-2">
          <PnlPill label="Hoje" value={todayPnl} />
          <PnlPill label="Ontem" value={yesterdayPnl} />
          <PnlPill label="7d" value={pnl7d} />
          <PnlPill label="30d" value={pnl30d} />
        </div>
      </div>

      {/* Day Profit */}
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

      {/* Action Buttons */}
      <div className="space-y-3 pt-2">
        {!dayRecord && (
          <button
            onClick={handleStartDay}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold transition-colors"
          >
            {loading ? <Spinner size={18} /> : <Play size={18} />}
            Iniciar Dia
          </button>
        )}
        {dayRecord && !dayRecord.closed && (
          <>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-semibold transition-colors"
            >
              {loading ? <Spinner size={18} /> : <RefreshCw size={18} />}
              Atualizar Saldos
            </button>
            <button
              onClick={handleCloseDay}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold transition-colors"
            >
              {loading ? <Spinner size={18} /> : <StopCircle size={18} />}
              Fechar Dia
            </button>
          </>
        )}
        {dayRecord?.closed && (
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-semibold transition-colors"
          >
            {loading ? <Spinner size={18} /> : <RefreshCw size={18} />}
            Atualizar Saldos
          </button>
        )}
      </div>

      <p className="text-center text-xs text-slate-600 pb-2">
        USD/BRL: R$ {usdBrl.toFixed(4)}
      </p>
    </div>
  )
}
