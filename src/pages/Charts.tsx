import { useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { getHistory } from '../services/storage'
import { formatUSDT, formatBRL, formatDate } from '../utils/format'
import type { DayRecord } from '../types'

const FILTER_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: 'Tudo', days: 0 },
]

const PIE_COLORS = ['#7c3aed', '#10b981', '#f97316']

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

export default function Charts() {
  const [filter, setFilter] = useState(30)

  const history = useMemo(() => getHistory(), [])

  const closed = useMemo(() => {
    const sorted = history
      .filter((r) => r.closed && r.endBalance)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (!filter) return sorted
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - filter)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    return sorted.filter((r) => r.date >= cutoffStr)
  }, [history, filter])

  // Line chart: patrimônio total
  const patrimonioData = closed.map((r) => ({
    date: formatDate(r.date),
    Patrimônio: r.endBalance!.total,
  }))

  // Bar chart: lucro diário em USDT
  const lucroDiarioData = closed.map((r) => ({
    date: formatDate(r.date),
    Lucro: r.profitUSDT ?? 0,
  }))

  // Pie chart: distribuição atual (last record's endBalance)
  const last = closed[closed.length - 1] as DayRecord | undefined
  const pieData = last?.endBalance
    ? [
        { name: 'BingX', value: last.endBalance.bingx },
        { name: 'Gate.io', value: last.endBalance.gate },
        { name: 'MEXC', value: last.endBalance.mexc },
      ].filter((d) => d.value > 0)
    : []

  const chartProps = {
    margin: { top: 10, right: 4, left: -10, bottom: 0 },
  }

  return (
    <div className="flex-1 px-4 pt-6 pb-28 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest">Gráficos</p>
          <h1 className="text-xl font-bold text-white">Análise</h1>
        </div>
        <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
          {FILTER_OPTIONS.map(({ label, days }) => (
            <button
              key={label}
              onClick={() => setFilter(days)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                filter === days ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
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
          {/* Patrimônio */}
          <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4">
            <p className="text-sm font-semibold text-slate-300 mb-4">Patrimônio Total (USDT)</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={patrimonioData} {...chartProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="Patrimônio"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={{ fill: '#7c3aed', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Lucro diário */}
          <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4">
            <p className="text-sm font-semibold text-slate-300 mb-4">Lucro Diário (USDT)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={lucroDiarioData} {...chartProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Lucro" radius={[4, 4, 0, 0]}>
                  {lucroDiarioData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.Lucro >= 0 ? '#10b981' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Distribuição */}
          {pieData.length > 0 && (
            <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4">
              <p className="text-sm font-semibold text-slate-300 mb-1">Distribuição Atual</p>
              <p className="text-xs text-slate-500 mb-4">Baseado no último dia fechado</p>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={160}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
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
                    const pct = last!.endBalance!.total > 0
                      ? ((entry.value / last!.endBalance!.total) * 100).toFixed(1)
                      : '0'
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

          {/* Stats summary */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Dias Positivos', value: closed.filter((r) => (r.profitUSDT ?? 0) > 0).length },
              { label: 'Dias Negativos', value: closed.filter((r) => (r.profitUSDT ?? 0) < 0).length },
              {
                label: 'Melhor Dia',
                value: closed.length
                  ? formatUSDT(Math.max(...closed.map((r) => r.profitUSDT ?? 0))) + ' USDT'
                  : '—',
              },
              {
                label: 'Lucro Total',
                value: formatBRL(closed.reduce((s, r) => s + (r.profitBRL ?? 0), 0)),
              },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className="text-lg font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
