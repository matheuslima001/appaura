import { useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { getHistory } from '../services/storage'
import { useBalances } from '../context/BalancesContext'
import { formatUSDT, formatBRL, formatDate } from '../utils/format'
import type { DayRecord } from '../types'

const FILTER_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: 'Tudo', days: 0 },
]

const PIE_COLORS = ['#f97316', '#3b82f6', '#10b981']

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl p-3 text-sm">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? formatUSDT(p.value) : p.value} USDT
        </p>
      ))}
    </div>
  )
}

function pnlSum(records: DayRecord[]) {
  return records.reduce((s, r) => s + (r.profitUSDT ?? 0), 0)
}

function currentStreak(records: DayRecord[]) {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date))
  if (!sorted.length) return 0
  const sign = (sorted[0].profitUSDT ?? 0) >= 0 ? 1 : -1
  let count = 0
  for (const r of sorted) {
    const s = (r.profitUSDT ?? 0) >= 0 ? 1 : -1
    if (s !== sign) break
    count++
  }
  return sign * count
}

export default function Statistics() {
  const [filter, setFilter] = useState(30)
  const { totalBalance, usdBrl } = useBalances()
  const allHistory = useMemo(() => getHistory(), [])

  const closed = useMemo(() => {
    const sorted = allHistory
      .filter((r) => r.closed && r.endBalance)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (!filter) return sorted
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - filter)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    return sorted.filter((r) => r.date >= cutoffStr)
  }, [allHistory, filter])

  const allClosed = useMemo(() =>
    allHistory.filter((r) => r.closed && r.endBalance).sort((a, b) => a.date.localeCompare(b.date)),
    [allHistory]
  )

  const patrimonioData = closed.map((r) => ({ date: formatDate(r.date), Patrimônio: r.endBalance!.total }))
  const lucroDiarioData = closed.map((r) => ({ date: formatDate(r.date), Lucro: r.profitUSDT ?? 0 }))

  const last = closed[closed.length - 1] as DayRecord | undefined
  const pieData = last?.endBalance
    ? [
        { name: 'BingX', value: last.endBalance.bingx },
        { name: 'Gate.io', value: last.endBalance.gate },
        { name: 'MEXC', value: last.endBalance.mexc },
      ].filter((d) => d.value > 0)
    : []

  // Period PnL
  function pnlForDays(days: number) {
    if (!days) return pnlSum(allClosed)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    return pnlSum(allClosed.filter((r) => r.date >= cutoffStr))
  }

  const yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]
  })()
  const yesterdayRecord = allClosed.find((r) => r.date === yesterday)

  const pnlPeriods = [
    { label: 'Hoje', value: pnlForDays(1) },
    { label: 'Ontem', value: yesterdayRecord?.profitUSDT ?? 0 },
    { label: '7d', value: pnlForDays(7) },
    { label: '15d', value: pnlForDays(15) },
    { label: '30d', value: pnlForDays(30) },
  ]

  const streak = currentStreak(allClosed)
  const posDays = allClosed.filter((r) => (r.profitUSDT ?? 0) > 0).length
  const negDays = allClosed.filter((r) => (r.profitUSDT ?? 0) < 0).length
  const avgDaily = allClosed.length ? pnlSum(allClosed) / allClosed.length : 0
  const bestDay = allClosed.reduce<DayRecord | null>((best, r) => !best || (r.profitUSDT ?? 0) > (best.profitUSDT ?? 0) ? r : best, null)
  const worstDay = allClosed.reduce<DayRecord | null>((worst, r) => !worst || (r.profitUSDT ?? 0) < (worst.profitUSDT ?? 0) ? r : worst, null)

  // Per exchange performance (last 30d)
  const cutoff30 = new Date(); cutoff30.setDate(cutoff30.getDate() - 30)
  const cutoff30Str = cutoff30.toISOString().split('T')[0]
  const last30 = allClosed.filter((r) => r.date >= cutoff30Str)
  const exchangePerf = (['bingx', 'gate', 'mexc'] as const).map((id) => {
    const label = { bingx: 'BingX', gate: 'Gate.io', mexc: 'MEXC' }[id]
    const pnl = last30.reduce((s, r) => {
      const start = r.startBalance[id] ?? 0
      const end = r.endBalance?.[id] ?? 0
      return s + (end - start)
    }, 0)
    return { label, pnl }
  })

  // Bank evolution
  const pnl30d = pnlForDays(30)
  const startBalance30 = totalBalance - pnl30d
  const roi30d = startBalance30 > 0 ? (pnl30d / startBalance30) * 100 : 0

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
          {pnlPeriods.slice(0, 3).map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
              <p className="text-[10px] text-slate-500 mb-1">{label}</p>
              <p className={`text-sm font-semibold ${value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {value >= 0 ? '+' : ''}{formatUSDT(value)}
              </p>
            </div>
          ))}
          {pnlPeriods.slice(3).map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
              <p className="text-[10px] text-slate-500 mb-1">{label}</p>
              <p className={`text-sm font-semibold ${value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {value >= 0 ? '+' : ''}{formatUSDT(value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {closed.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          <p className="text-4xl mb-3">📈</p>
          <p>Sem dados para o período.</p>
          <p className="text-sm mt-1">Feche alguns dias no Dashboard.</p>
        </div>
      ) : (
        <>
          {/* Indicators */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Indicadores</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
                <p className="text-[10px] text-slate-500 mb-1">Média Diária</p>
                <p className={`text-sm font-semibold ${avgDaily >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {avgDaily >= 0 ? '+' : ''}{formatUSDT(avgDaily)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
                <p className="text-[10px] text-slate-500 mb-1">Sequência Atual</p>
                <p className={`text-sm font-semibold ${streak >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {streak > 0 ? `+${streak} ✅` : streak < 0 ? `${streak} ❌` : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
                <p className="text-[10px] text-slate-500 mb-1">Dias Positivos</p>
                <p className="text-sm font-semibold text-emerald-400">{posDays}</p>
              </div>
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
                <p className="text-[10px] text-slate-500 mb-1">Dias Negativos</p>
                <p className="text-sm font-semibold text-red-400">{negDays}</p>
              </div>
            </div>
          </div>

          {/* Highlights */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Destaques</p>
            <div className="grid grid-cols-2 gap-2">
              {bestDay && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
                  <p className="text-[10px] text-slate-500 mb-1">Melhor Dia</p>
                  <p className="text-sm font-semibold text-emerald-400">+{formatUSDT(bestDay.profitUSDT ?? 0)}</p>
                  <p className="text-[10px] text-slate-500">{formatDate(bestDay.date)}</p>
                </div>
              )}
              {worstDay && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-[10px] text-slate-500 mb-1">Pior Dia</p>
                  <p className="text-sm font-semibold text-red-400">{formatUSDT(worstDay.profitUSDT ?? 0)}</p>
                  <p className="text-[10px] text-slate-500">{formatDate(worstDay.date)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Charts */}
          <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4">
            <p className="text-sm font-semibold text-slate-300 mb-4">Patrimônio Total (USDT)</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={patrimonioData} {...chartProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="Patrimônio" stroke="#7c3aed" strokeWidth={2} dot={{ fill: '#7c3aed', r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4">
            <p className="text-sm font-semibold text-slate-300 mb-4">Lucro Diário (USDT)</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={lucroDiarioData} {...chartProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Lucro" radius={[4, 4, 0, 0]}>
                  {lucroDiarioData.map((entry, index) => (
                    <Cell key={index} fill={entry.Lucro >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Per exchange */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Performance por Corretora (30d)</p>
            <div className="space-y-2">
              {exchangePerf.map(({ label, pnl }) => (
                <div key={label} className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3 flex justify-between items-center">
                  <span className="text-sm text-slate-300">{label}</span>
                  <span className={`text-sm font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pnl >= 0 ? '+' : ''}{formatUSDT(pnl)} USDT
                  </span>
                </div>
              ))}
            </div>
          </div>

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

          {/* Pie chart */}
          {pieData.length > 0 && (
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4">
              <p className="text-sm font-semibold text-slate-300 mb-1">Distribuição por Corretora</p>
              <p className="text-xs text-slate-500 mb-4">Baseado no último dia fechado</p>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {pieData.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${formatUSDT(Number(value))} USDT`, '']}
                      contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {pieData.map((entry, i) => {
                    const pct = last!.endBalance!.total > 0 ? ((entry.value / last!.endBalance!.total) * 100).toFixed(1) : '0'
                    return (
                      <div key={entry.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                          <span className="text-slate-400">{entry.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-white font-medium">{pct}%</span>
                          <p className="text-xs text-slate-500">{formatUSDT(entry.value)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
