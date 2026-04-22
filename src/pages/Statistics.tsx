import { useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { getSnapshotHistory } from '../services/storage'
import { useBalances } from '../context/BalancesContext'
import { formatUSDT, formatBRL } from '../utils/format'
import type { SnapshotRecord } from '../types'

const FILTER_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: 'Tudo', days: 0 },
]

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl p-3 text-sm">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatUSDT(p.value)} USDT
        </p>
      ))}
    </div>
  )
}

function fmtDT(iso: string) {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}h`
}

function pnlSum(records: SnapshotRecord[]) {
  return records.reduce((s, r) => s + r.profitUSDT, 0)
}

function currentStreak(records: SnapshotRecord[]) {
  const sorted = [...records].sort((a, b) => b.endSnapshot.timestamp.localeCompare(a.endSnapshot.timestamp))
  if (!sorted.length) return 0
  const sign = sorted[0].profitUSDT >= 0 ? 1 : -1
  let count = 0
  for (const r of sorted) {
    const s = r.profitUSDT >= 0 ? 1 : -1
    if (s !== sign) break
    count++
  }
  return sign * count
}

function filterByDays(records: SnapshotRecord[], days: number) {
  if (!days) return records
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return records.filter((r) => new Date(r.endSnapshot.timestamp) >= cutoff)
}

export default function Statistics() {
  const [filter, setFilter] = useState(30)
  const { totalBalance, usdBrl } = useBalances()

  const allHistory = useMemo(() => getSnapshotHistory()
    .sort((a, b) => a.endSnapshot.timestamp.localeCompare(b.endSnapshot.timestamp)), [])

  const filtered = useMemo(() => filterByDays(allHistory, filter), [allHistory, filter])

  const patrimonioData = filtered.map((r) => ({
    date: fmtDT(r.endSnapshot.timestamp),
    Patrimônio: r.endSnapshot.balance,
  }))

  const lucroData = filtered.map((r) => ({
    date: fmtDT(r.endSnapshot.timestamp),
    Lucro: r.profitUSDT,
  }))

  function pnlForDays(days: number) {
    return pnlSum(filterByDays(allHistory, days))
  }

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const todayPnl = pnlSum(allHistory.filter((r) => new Date(r.endSnapshot.timestamp) >= todayStart))
  const yesterdayPnl = pnlSum(allHistory.filter((r) => {
    const d = new Date(r.endSnapshot.timestamp)
    return d >= yesterdayStart && d < todayStart
  }))

  const pnlPeriods = [
    { label: 'Hoje', value: todayPnl },
    { label: 'Ontem', value: yesterdayPnl },
    { label: '7d', value: pnlForDays(7) },
    { label: '15d', value: pnlForDays(15) },
    { label: '30d', value: pnlForDays(30) },
  ]

  const streak = currentStreak(allHistory)
  const posCount = allHistory.filter((r) => r.profitUSDT > 0).length
  const negCount = allHistory.filter((r) => r.profitUSDT < 0).length
  const avgPerSnap = allHistory.length ? pnlSum(allHistory) / allHistory.length : 0
  const best = allHistory.reduce<SnapshotRecord | null>((b, r) => !b || r.profitUSDT > b.profitUSDT ? r : b, null)
  const worst = allHistory.reduce<SnapshotRecord | null>((w, r) => !w || r.profitUSDT < w.profitUSDT ? r : w, null)

  const pnl30d = pnlForDays(30)
  const startBal30 = totalBalance - pnl30d
  const roi30d = startBal30 > 0 ? (pnl30d / startBal30) * 100 : 0

  const chartProps = { margin: { top: 10, right: 4, left: -10, bottom: 0 } }

  return (
    <div className="flex-1 px-4 pt-6 pb-28 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest">Estatísticas</p>
          <h1 className="text-xl font-bold text-white">Análise</h1>
        </div>
        <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
          {FILTER_OPTIONS.map(({ label, days }) => (
            <button
              key={label}
              onClick={() => setFilter(days)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${filter === days ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* PnL Period Cards */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">PnL por Período</p>
        <div className="grid grid-cols-3 gap-2">
          {pnlPeriods.map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
              <p className="text-[10px] text-slate-500 mb-1">{label}</p>
              <p className={`text-sm font-semibold ${value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {value >= 0 ? '+' : ''}{formatUSDT(value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {allHistory.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          <p className="text-4xl mb-3">📈</p>
          <p>Sem snapshots registrados.</p>
          <p className="text-sm mt-1">Use "Novo Snapshot" no Dashboard.</p>
        </div>
      ) : (
        <>
          {/* Indicators */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Indicadores</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
                <p className="text-[10px] text-slate-500 mb-1">Média por Snapshot</p>
                <p className={`text-sm font-semibold ${avgPerSnap >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {avgPerSnap >= 0 ? '+' : ''}{formatUSDT(avgPerSnap)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
                <p className="text-[10px] text-slate-500 mb-1">Sequência Atual</p>
                <p className={`text-sm font-semibold ${streak >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {streak > 0 ? `+${streak} ✅` : streak < 0 ? `${streak} ❌` : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
                <p className="text-[10px] text-slate-500 mb-1">Positivos</p>
                <p className="text-sm font-semibold text-emerald-400">{posCount}</p>
              </div>
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
                <p className="text-[10px] text-slate-500 mb-1">Negativos</p>
                <p className="text-sm font-semibold text-red-400">{negCount}</p>
              </div>
            </div>
          </div>

          {/* Highlights */}
          {(best || worst) && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Destaques</p>
              <div className="grid grid-cols-2 gap-2">
                {best && (
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
                    <p className="text-[10px] text-slate-500 mb-1">Melhor Snapshot</p>
                    <p className="text-sm font-semibold text-emerald-400">+{formatUSDT(best.profitUSDT)}</p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(best.endSnapshot.timestamp).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}
                {worst && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                    <p className="text-[10px] text-slate-500 mb-1">Pior Snapshot</p>
                    <p className="text-sm font-semibold text-red-400">{formatUSDT(worst.profitUSDT)}</p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(worst.endSnapshot.timestamp).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Charts */}
          {filtered.length > 1 && (
            <>
              <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4">
                <p className="text-sm font-semibold text-slate-300 mb-4">Patrimônio Total (USDT)</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={patrimonioData} {...chartProps}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="Patrimônio" stroke="#7c3aed" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4">
                <p className="text-sm font-semibold text-slate-300 mb-4">Lucro por Snapshot (USDT)</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={lucroData} {...chartProps}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="Lucro" radius={[4, 4, 0, 0]}>
                      {lucroData.map((entry, i) => (
                        <Cell key={i} fill={entry.Lucro >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* Bank evolution */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Evolução da Banca</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
                <p className="text-[10px] text-slate-500 mb-1">Atual</p>
                <p className="text-sm font-semibold text-white">{formatUSDT(totalBalance)}</p>
                <p className="text-[10px] text-slate-500">{formatBRL(totalBalance * usdBrl)}</p>
              </div>
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
                <p className="text-[10px] text-slate-500 mb-1">PnL 30d</p>
                <p className={`text-sm font-semibold ${pnl30d >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pnl30d >= 0 ? '+' : ''}{formatUSDT(pnl30d)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
                <p className="text-[10px] text-slate-500 mb-1">ROI 30d</p>
                <p className={`text-sm font-semibold ${roi30d >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {roi30d >= 0 ? '+' : ''}{roi30d.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
