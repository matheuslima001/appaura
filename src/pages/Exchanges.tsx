import { RefreshCw, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { useBalances } from '../context/BalancesContext'
import { getHistory, getOperations } from '../services/storage'
import { formatUSDT, formatBRL, formatTime, todayStr } from '../utils/format'
import Spinner from '../components/Spinner'
import type { ExchangeId } from '../types'

const EXCHANGE_LABELS: Record<ExchangeId, string> = {
  bingx: 'BingX',
  gate: 'Gate.io',
  mexc: 'MEXC',
}

const EXCHANGE_COLORS: Record<ExchangeId, string> = {
  bingx: '#f97316',
  gate: '#3b82f6',
  mexc: '#10b981',
}

function statusDot(balance: number | null, error: string | null, loading: boolean) {
  if (loading) return 'bg-amber-400 animate-pulse'
  if (error) return 'bg-red-500'
  if (balance === null) return 'bg-slate-600'
  if (balance > 0) return 'bg-emerald-500'
  return 'bg-amber-400'
}

export default function Exchanges() {
  const { exchanges, totalBalance, usdBrl, loading, lastUpdate, refresh } = useBalances()
  const today = todayStr()
  const history = getHistory()
  const operations = getOperations()

  const todayRecord = history.find((r) => r.date === today)

  async function handleRefresh() {
    await refresh()
    toast.success('Saldos atualizados')
  }

  return (
    <div className="flex-1 px-4 pt-6 pb-28 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest">Corretoras</p>
          <h1 className="text-xl font-bold text-white">Saldos</h1>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Clock size={12} />
              {formatTime(lastUpdate)}
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700/50 text-slate-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            {loading ? <Spinner size={16} /> : <RefreshCw size={16} />}
          </button>
        </div>
      </div>

      {/* Total */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-600/20 to-indigo-800/10 border border-violet-500/20 p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1">Total Consolidado</p>
          <p className="text-2xl font-bold text-white">{formatUSDT(totalBalance)} <span className="text-sm text-slate-400 font-normal">USDT</span></p>
          <p className="text-sm text-slate-400">{formatBRL(totalBalance * usdBrl)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 mb-1">Atualização</p>
          <p className="text-xs text-slate-400">{lastUpdate ? formatTime(lastUpdate) : '—'}</p>
        </div>
      </div>

      {/* Exchange Cards */}
      <div className="space-y-3">
        {exchanges.map((ex) => {
          const openOps = operations.filter((o) => o.status === 'open' && o.exchange === ex.id)
          const inPositions = openOps.reduce((s, o) => s + o.entryPrice * o.qty, 0)
          const available = (ex.balance ?? 0) - inPositions

          const todayStart = todayRecord?.startBalance[ex.id] ?? 0
          const currentBal = ex.balance ?? 0
          const dayPnl = todayRecord ? currentBal - todayStart : null

          const color = EXCHANGE_COLORS[ex.id]

          return (
            <div
              key={ex.id}
              className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${statusDot(ex.balance, ex.error, ex.loading)}`}
                  />
                  <span className="font-semibold text-white">{EXCHANGE_LABELS[ex.id]}</span>
                </div>
                {ex.loading ? (
                  <Spinner size={16} />
                ) : ex.error ? (
                  <span className="text-xs text-red-400">{ex.error}</span>
                ) : null}
              </div>

              {ex.balance === null && !ex.loading ? (
                <p className="text-sm text-slate-500">Não configurada ou desabilitada</p>
              ) : (
                <>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-white">
                      {formatUSDT(ex.balance ?? 0)}
                    </span>
                    <span className="text-slate-500 mb-0.5 text-sm">USDT</span>
                  </div>
                  <p className="text-sm text-slate-400">{formatBRL((ex.balance ?? 0) * usdBrl)}</p>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="rounded-xl bg-slate-700/40 p-2.5">
                      <p className="text-[10px] text-slate-500 mb-1">Disponível</p>
                      <p className="text-sm font-medium text-white">{formatUSDT(available)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-700/40 p-2.5">
                      <p className="text-[10px] text-slate-500 mb-1">Em Posições</p>
                      <p className="text-sm font-medium text-amber-400">{formatUSDT(inPositions)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-700/40 p-2.5">
                      <p className="text-[10px] text-slate-500 mb-1">PnL Hoje</p>
                      <p className={`text-sm font-medium ${dayPnl === null ? 'text-slate-500' : dayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {dayPnl === null ? '—' : `${dayPnl >= 0 ? '+' : ''}${formatUSDT(dayPnl)}`}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-700/40 p-2.5">
                      <p className="text-[10px] text-slate-500 mb-1">Ops Abertas</p>
                      <p className="text-sm font-medium text-white">{openOps.length}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {totalBalance > 0 && (
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                        <span>Proporção no portfólio</span>
                        <span>{((( ex.balance ?? 0) / totalBalance) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${((ex.balance ?? 0) / totalBalance) * 100}%`,
                            background: color,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
