import { useState } from 'react'
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react'
import { getSnapshotHistory } from '../services/storage'
import { formatUSDT, formatBRL, formatPct } from '../utils/format'
import type { SnapshotRecord } from '../types'

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function SnapshotCard({ record }: { record: SnapshotRecord }) {
  const [open, setOpen] = useState(false)
  const positive = record.profitUSDT >= 0

  return (
    <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${positive ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <div>
            <p className="font-semibold text-white text-sm">{formatDateTime(record.endSnapshot.timestamp)}</p>
            <p className="text-xs text-slate-500">
              Base: {formatUSDT(record.startSnapshot.balance)} → {formatUSDT(record.endSnapshot.balance)} USDT
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`text-right ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
            <p className="font-semibold text-sm">{formatPct(record.profitPct)}</p>
            <p className="text-xs">{record.profitUSDT >= 0 ? '+' : ''}{formatUSDT(record.profitUSDT)}</p>
          </div>
          {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-700/50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-700/40 p-3">
              <p className="text-xs text-slate-500 mb-1">Snapshot Base</p>
              <p className="font-semibold text-white text-sm">{formatUSDT(record.startSnapshot.balance)} USDT</p>
              <p className="text-xs text-slate-500">{formatDateTime(record.startSnapshot.timestamp)}</p>
            </div>
            <div className="rounded-xl bg-slate-700/40 p-3">
              <p className="text-xs text-slate-500 mb-1">Snapshot Final</p>
              <p className="font-semibold text-white text-sm">{formatUSDT(record.endSnapshot.balance)} USDT</p>
              <p className="text-xs text-slate-500">{formatDateTime(record.endSnapshot.timestamp)}</p>
            </div>
            <div className={`rounded-xl p-3 ${positive ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
              <p className="text-xs text-slate-500 mb-1">Lucro USDT</p>
              <p className={`font-semibold text-sm ${positive ? 'text-emerald-300' : 'text-red-300'}`}>
                {record.profitUSDT >= 0 ? '+' : ''}{formatUSDT(record.profitUSDT)}
              </p>
            </div>
            <div className={`rounded-xl p-3 ${positive ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
              <p className="text-xs text-slate-500 mb-1">Lucro BRL</p>
              <p className={`font-semibold text-sm ${positive ? 'text-emerald-300' : 'text-red-300'}`}>
                {formatBRL(record.profitBRL)}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-600">
            USD/BRL na base: R$ {record.startSnapshot.usdBrlRate.toFixed(4)}
          </p>
        </div>
      )}
    </div>
  )
}

export default function History() {
  const records = getSnapshotHistory()
    .slice()
    .sort((a, b) => b.endSnapshot.timestamp.localeCompare(a.endSnapshot.timestamp))

  const totalProfitUSDT = records.reduce((s, r) => s + r.profitUSDT, 0)
  const totalProfitBRL = records.reduce((s, r) => s + r.profitBRL, 0)
  const positive = totalProfitUSDT >= 0

  return (
    <div className="flex-1 px-4 pt-6 pb-28 space-y-4">
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-widest">Histórico</p>
        <h1 className="text-xl font-bold text-white">{records.length} snapshots registrados</h1>
      </div>

      {records.length > 0 && (
        <div className={`rounded-2xl p-4 border ${positive ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="flex items-center gap-2 mb-2">
            {positive ? <TrendingUp size={16} className="text-emerald-400" /> : <TrendingDown size={16} className="text-red-400" />}
            <span className="text-xs text-slate-400 uppercase tracking-wider">Lucro Acumulado</span>
          </div>
          <p className={`text-2xl font-bold ${positive ? 'text-emerald-300' : 'text-red-300'}`}>
            {totalProfitUSDT >= 0 ? '+' : ''}{formatUSDT(totalProfitUSDT)} USDT
          </p>
          <p className="text-sm text-slate-400">{formatBRL(totalProfitBRL)}</p>
        </div>
      )}

      {records.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          <p className="text-4xl mb-3">📷</p>
          <p>Nenhum snapshot registrado.</p>
          <p className="text-sm mt-1">Use "Novo Snapshot" no Dashboard para salvar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((r) => <SnapshotCard key={r.id} record={r} />)}
        </div>
      )}
    </div>
  )
}
