import { useState } from 'react'
import toast from 'react-hot-toast'
import { Camera, RefreshCw, RotateCcw, Clock, TrendingUp, TrendingDown } from 'lucide-react'
import Spinner from '../components/Spinner'
import {
  getBaseSnapshot, saveBaseSnapshot,
  addSnapshotRecord, getSnapshotHistory, getOperations,
} from '../services/storage'
import { getUsdBrlRate } from '../services/rates'
import { useBalances } from '../context/BalancesContext'
import { formatUSDT, formatBRL, formatPct, formatTime, todayStr } from '../utils/format'
import type { Snapshot, SnapshotRecord } from '../types'

function newId() {
  return `snap_${Date.now()}`
}

function pnlForDays(days: number) {
  const history = getSnapshotHistory()
  if (!days) return history.reduce((s, r) => s + r.profitUSDT, 0)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffISO = cutoff.toISOString()
  return history
    .filter((r) => r.endSnapshot.timestamp >= cutoffISO)
    .reduce((s, r) => s + r.profitUSDT, 0)
}

function yesterdayISO() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function todayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default function Dashboard() {
  const { totalBalance, usdBrl, loading, lastUpdate, refresh } = useBalances()
  const [baseSnapshot, setBaseSnapshot] = useState<Snapshot | null>(() => getBaseSnapshot())
  const [actionLoading, setActionLoading] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const isLoading = loading || actionLoading

  const operations = getOperations()
  const openOps = operations.filter((o) => o.status === 'open')
  const inPositions = openOps.reduce((s, o) => s + o.entryPrice * o.qty, 0)
  const available = totalBalance - inPositions

  const liveProfitUSDT = baseSnapshot ? totalBalance - baseSnapshot.balance : 0
  const liveProfitBRL = liveProfitUSDT * usdBrl
  const liveProfitPct = baseSnapshot && baseSnapshot.balance > 0
    ? (liveProfitUSDT / baseSnapshot.balance) * 100
    : 0
  const profitPositive = liveProfitUSDT >= 0

  const history = getSnapshotHistory()
  const todayStart = todayISO()
  const yesterdayStart = yesterdayISO()
  const todayPnl = history
    .filter((r) => r.endSnapshot.timestamp >= todayStart)
    .reduce((s, r) => s + r.profitUSDT, 0)
  const yesterdayPnl = history
    .filter((r) => r.endSnapshot.timestamp >= yesterdayStart && r.endSnapshot.timestamp < todayStart)
    .reduce((s, r) => s + r.profitUSDT, 0)
  const pnl7d = pnlForDays(7)
  const pnl30d = pnlForDays(30)

  async function handleSnapshot() {
    setActionLoading(true)
    try {
      const rate = await getUsdBrlRate()
      const snap: Snapshot = {
        balance: totalBalance,
        timestamp: new Date().toISOString(),
        usdBrlRate: rate,
      }
      saveBaseSnapshot(snap)
      setBaseSnapshot(snap)
      toast.success('Snapshot registrado!')
    } catch {
      toast.error('Erro ao registrar snapshot')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleNewSnapshot() {
    if (!baseSnapshot) return
    setActionLoading(true)
    try {
      const rate = await getUsdBrlRate()
      const endSnap: Snapshot = {
        balance: totalBalance,
        timestamp: new Date().toISOString(),
        usdBrlRate: rate,
      }
      const profitUSDT = endSnap.balance - baseSnapshot.balance
      const profitBRL = profitUSDT * rate
      const profitPct = baseSnapshot.balance > 0 ? (profitUSDT / baseSnapshot.balance) * 100 : 0
      const record: SnapshotRecord = {
        id: newId(),
        startSnapshot: baseSnapshot,
        endSnapshot: endSnap,
        profitUSDT,
        profitBRL,
        profitPct,
      }
      addSnapshotRecord(record)
      saveBaseSnapshot(endSnap)
      setBaseSnapshot(endSnap)
      toast.success('Snapshot salvo no histórico!')
    } catch {
      toast.error('Erro ao salvar snapshot')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReset() {
    setActionLoading(true)
    setShowResetConfirm(false)
    try {
      const rate = await getUsdBrlRate()
      const snap: Snapshot = {
        balance: totalBalance,
        timestamp: new Date().toISOString(),
        usdBrlRate: rate,
      }
      saveBaseSnapshot(snap)
      setBaseSnapshot(snap)
      toast.success('Referência zerada!')
    } catch {
      toast.error('Erro ao redefinir referência')
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
          <h1 className="text-xl font-bold text-white">{todayStr().split('-').reverse().join('/')}</h1>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Clock size={12} />
              {formatTime(lastUpdate)}
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            {isLoading ? <Spinner size={15} /> : <RefreshCw size={15} />}
          </button>
        </div>
      </div>

      {/* Total Balance */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-600/30 to-indigo-800/20 border border-violet-500/30 p-5">
        <p className="text-xs text-violet-300 uppercase tracking-wider mb-1">Saldo Total</p>
        <div className="flex items-end gap-3">
          {isLoading && !totalBalance ? (
            <Spinner size={28} />
          ) : (
            <>
              <span className="text-3xl font-bold text-white">{formatUSDT(totalBalance)}</span>
              <span className="text-slate-400 mb-0.5">USDT</span>
            </>
          )}
        </div>
        <p className="text-sm text-slate-400 mt-1">{formatBRL(totalBalance * usdBrl)}</p>
        {baseSnapshot && (
          <p className="text-xs text-slate-500 mt-2">
            Base: {formatUSDT(baseSnapshot.balance)} USDT · {formatTime(new Date(baseSnapshot.timestamp))}
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

      {/* Live profit since snapshot */}
      {baseSnapshot && (
        <div className={`rounded-2xl border p-5 ${profitPositive ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="flex items-center gap-2 mb-2">
            {profitPositive
              ? <TrendingUp size={18} className="text-emerald-400" />
              : <TrendingDown size={18} className="text-red-400" />}
            <p className={`text-xs uppercase tracking-wider ${profitPositive ? 'text-emerald-300' : 'text-red-300'}`}>
              Lucro desde snapshot
            </p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${profitPositive ? 'text-emerald-300' : 'text-red-300'}`}>
              {formatPct(liveProfitPct)}
            </span>
            <span className={`text-sm ${profitPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {liveProfitUSDT >= 0 ? '+' : ''}{formatUSDT(liveProfitUSDT)} USDT
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">{formatBRL(liveProfitBRL)}</p>
        </div>
      )}

      {/* PnL by period (from snapshot history) */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">PnL por Período</p>
        <div className="flex gap-2">
          <PnlPill label="Hoje" value={todayPnl} />
          <PnlPill label="Ontem" value={yesterdayPnl} />
          <PnlPill label="7d" value={pnl7d} />
          <PnlPill label="30d" value={pnl30d} />
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-3 pt-1">
        {!baseSnapshot ? (
          <button
            onClick={handleSnapshot}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold transition-colors"
          >
            {isLoading ? <Spinner size={18} /> : <Camera size={18} />}
            Registrar Snapshot
          </button>
        ) : (
          <>
            <button
              onClick={handleNewSnapshot}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold transition-colors"
            >
              {isLoading ? <Spinner size={18} /> : <Camera size={18} />}
              Novo Snapshot
            </button>

            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-slate-600 text-slate-400 hover:text-white hover:bg-slate-700/60 disabled:opacity-50 text-sm transition-colors"
              >
                <RotateCcw size={15} />
                Resetar referência
              </button>
            ) : (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
                <p className="text-sm text-center text-amber-300">
                  Definir {formatUSDT(totalBalance)} USDT como nova referência?<br />
                  <span className="text-xs text-slate-400">O lucro será zerado. Não salva no histórico.</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm hover:bg-slate-700/60 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-center text-xs text-slate-600 pb-2">
        USD/BRL: R$ {usdBrl.toFixed(4)}
      </p>
    </div>
  )
}
