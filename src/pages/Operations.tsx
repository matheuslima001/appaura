import { useState } from 'react'
import { Plus, X, CheckCircle, Pencil, TrendingUp, TrendingDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { getOperations, upsertOperation, deleteOperation } from '../services/storage'
import { formatUSDT } from '../utils/format'
import type { Operation, ExchangeId } from '../types'

type Tab = 'open' | 'closed'

const EXCHANGE_OPTIONS: ExchangeId[] = ['bingx', 'gate', 'mexc']
const EXCHANGE_LABELS: Record<ExchangeId, string> = { bingx: 'BingX', gate: 'Gate.io', mexc: 'MEXC' }

function newId() {
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

const EMPTY_FORM = {
  pair: '',
  exchange: 'bingx' as ExchangeId,
  type: 'SPOT' as 'SPOT' | 'FUTURES',
  side: 'LONG' as 'LONG' | 'SHORT',
  entryPrice: '',
  currentPrice: '',
  qty: '',
}

function pnlCalc(op: Operation) {
  const current = op.status === 'closed' ? (op.exitPrice ?? op.currentPrice) : op.currentPrice
  const diff = op.side === 'LONG' ? current - op.entryPrice : op.entryPrice - current
  const pnlUSDT = diff * op.qty
  const pnlPct = op.entryPrice > 0 ? (diff / op.entryPrice) * 100 : 0
  const value = op.entryPrice * op.qty
  return { pnlUSDT, pnlPct, value }
}

interface RowProps {
  op: Operation
  onClose: (op: Operation) => void
  onDelete: (id: string) => void
  onEditPrice: (op: Operation) => void
}

function OperationRow({ op, onClose, onDelete, onEditPrice }: RowProps) {
  const { pnlUSDT, pnlPct, value } = pnlCalc(op)
  const pos = pnlUSDT >= 0

  return (
    <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{op.pair}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${op.type === 'FUTURES' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
              {op.type}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${op.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {op.side}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{EXCHANGE_LABELS[op.exchange]}</p>
        </div>
        <div className="flex gap-1">
          {op.status === 'open' && (
            <>
              <button onClick={() => onEditPrice(op)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors">
                <Pencil size={14} />
              </button>
              <button onClick={() => onClose(op)} className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-slate-500 hover:text-emerald-400 transition-colors">
                <CheckCircle size={14} />
              </button>
            </>
          )}
          <button onClick={() => onDelete(op.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-slate-500 mb-0.5">Entrada</p>
          <p className="text-white font-medium">${op.entryPrice.toFixed(4)}</p>
        </div>
        <div>
          <p className="text-slate-500 mb-0.5">Atual</p>
          <p className="text-white font-medium">
            ${(op.status === 'closed' ? (op.exitPrice ?? op.currentPrice) : op.currentPrice).toFixed(4)}
          </p>
        </div>
        <div>
          <p className="text-slate-500 mb-0.5">Qtd</p>
          <p className="text-white font-medium">{op.qty}</p>
        </div>
        <div>
          <p className="text-slate-500 mb-0.5">Valor</p>
          <p className="text-white font-medium">{formatUSDT(value)}</p>
        </div>
        <div>
          <p className="text-slate-500 mb-0.5">PnL USDT</p>
          <p className={`font-medium ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnlUSDT >= 0 ? '+' : ''}{formatUSDT(pnlUSDT)}
          </p>
        </div>
        <div>
          <p className="text-slate-500 mb-0.5">PnL %</p>
          <div className={`flex items-center gap-0.5 font-medium ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
            {pos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  )
}

interface AddFormProps {
  onAdd: (op: Operation) => void
  onCancel: () => void
}

function AddForm({ onAdd, onCancel }: AddFormProps) {
  const [form, setForm] = useState(EMPTY_FORM)

  function set(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit() {
    if (!form.pair || !form.entryPrice || !form.currentPrice || !form.qty) {
      toast.error('Preencha todos os campos')
      return
    }
    const op: Operation = {
      id: newId(),
      pair: form.pair.toUpperCase(),
      exchange: form.exchange,
      type: form.type,
      side: form.side,
      entryPrice: parseFloat(form.entryPrice),
      currentPrice: parseFloat(form.currentPrice),
      qty: parseFloat(form.qty),
      openedAt: new Date().toISOString(),
      status: 'open',
    }
    onAdd(op)
  }

  const inputCls = 'w-full bg-slate-700/60 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500'
  const selectCls = 'w-full bg-slate-700/60 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500'

  return (
    <div className="rounded-2xl bg-slate-800/60 border border-violet-500/30 p-4 space-y-3">
      <p className="font-semibold text-white text-sm">Nova Operação</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="text-xs text-slate-500 block mb-1">Par (ex: BTC/USDT)</label>
          <input className={inputCls} placeholder="BTC/USDT" value={form.pair} onChange={(e) => set('pair', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Corretora</label>
          <select className={selectCls} value={form.exchange} onChange={(e) => set('exchange', e.target.value)}>
            {EXCHANGE_OPTIONS.map((id) => <option key={id} value={id}>{EXCHANGE_LABELS[id]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Tipo</label>
          <select className={selectCls} value={form.type} onChange={(e) => set('type', e.target.value as 'SPOT' | 'FUTURES')}>
            <option value="SPOT">SPOT</option>
            <option value="FUTURES">FUTURES</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Direção</label>
          <select className={selectCls} value={form.side} onChange={(e) => set('side', e.target.value as 'LONG' | 'SHORT')}>
            <option value="LONG">LONG</option>
            <option value="SHORT">SHORT</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Preço Entrada</label>
          <input className={inputCls} type="number" placeholder="0.00" value={form.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Preço Atual</label>
          <input className={inputCls} type="number" placeholder="0.00" value={form.currentPrice} onChange={(e) => set('currentPrice', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Quantidade</label>
          <input className={inputCls} type="number" placeholder="0.00" value={form.qty} onChange={(e) => set('qty', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm hover:bg-slate-700/60 transition-colors">
          Cancelar
        </button>
        <button onClick={handleSubmit} className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors">
          Adicionar
        </button>
      </div>
    </div>
  )
}

interface EditPriceFormProps {
  op: Operation
  onSave: (op: Operation) => void
  onCancel: () => void
  isClose?: boolean
}

function EditPriceForm({ op, onSave, onCancel, isClose }: EditPriceFormProps) {
  const [price, setPrice] = useState(String(op.currentPrice))

  function handleSave() {
    const val = parseFloat(price)
    if (isNaN(val) || val <= 0) { toast.error('Preço inválido'); return }
    if (isClose) {
      onSave({ ...op, exitPrice: val, currentPrice: val, status: 'closed', closedAt: new Date().toISOString() })
    } else {
      onSave({ ...op, currentPrice: val })
    }
  }

  return (
    <div className="rounded-2xl bg-slate-800/60 border border-amber-500/30 p-4 space-y-3">
      <p className="font-semibold text-white text-sm">{isClose ? `Fechar ${op.pair}` : `Atualizar preço — ${op.pair}`}</p>
      <div>
        <label className="text-xs text-slate-500 block mb-1">{isClose ? 'Preço de Saída' : 'Preço Atual'}</label>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full bg-slate-700/60 border border-slate-600/50 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
        />
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm hover:bg-slate-700/60 transition-colors">
          Cancelar
        </button>
        <button onClick={handleSave} className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors ${isClose ? 'bg-emerald-700 hover:bg-emerald-600' : 'bg-amber-600 hover:bg-amber-500'}`}>
          {isClose ? 'Fechar Operação' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

export default function Operations() {
  const [tab, setTab] = useState<Tab>('open')
  const [ops, setOps] = useState<Operation[]>(() => getOperations())
  const [showAdd, setShowAdd] = useState(false)
  const [editingOp, setEditingOp] = useState<Operation | null>(null)
  const [closingOp, setClosingOp] = useState<Operation | null>(null)

  const openOps = ops.filter((o) => o.status === 'open')
  const closedOps = ops.filter((o) => o.status === 'closed').sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))

  const totalOpenPnl = openOps.reduce((s, o) => s + pnlCalc(o).pnlUSDT, 0)
  const totalClosedPnl = closedOps.reduce((s, o) => s + pnlCalc(o).pnlUSDT, 0)

  function handleAdd(op: Operation) {
    upsertOperation(op)
    setOps(getOperations())
    setShowAdd(false)
    toast.success('Operação adicionada!')
  }

  function handleSaveEdit(op: Operation) {
    upsertOperation(op)
    setOps(getOperations())
    setEditingOp(null)
    setClosingOp(null)
    toast.success(op.status === 'closed' ? 'Operação fechada!' : 'Preço atualizado!')
  }

  function handleDelete(id: string) {
    deleteOperation(id)
    setOps(getOperations())
    toast.success('Operação removida')
  }

  const displayed = tab === 'open' ? openOps : closedOps
  const totalPnl = tab === 'open' ? totalOpenPnl : totalClosedPnl

  return (
    <div className="flex-1 px-4 pt-6 pb-28 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest">Operações</p>
          <h1 className="text-xl font-bold text-white">Trades</h1>
        </div>
        {!showAdd && !editingOp && !closingOp && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Nova
          </button>
        )}
      </div>

      {showAdd && <AddForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} />}
      {editingOp && <EditPriceForm op={editingOp} onSave={handleSaveEdit} onCancel={() => setEditingOp(null)} />}
      {closingOp && <EditPriceForm op={closingOp} onSave={handleSaveEdit} onCancel={() => setClosingOp(null)} isClose />}

      {/* Tabs */}
      <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
        {(['open', 'closed'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {t === 'open' ? `Abertas (${openOps.length})` : `Fechadas (${closedOps.length})`}
          </button>
        ))}
      </div>

      {/* PnL Summary */}
      {displayed.length > 0 && (
        <div className={`rounded-xl border p-3 flex items-center justify-between ${totalPnl >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <p className="text-xs text-slate-400">PnL Total ({tab === 'open' ? 'Abertas' : 'Fechadas'})</p>
          <p className={`font-semibold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalPnl >= 0 ? '+' : ''}{formatUSDT(totalPnl)} USDT
          </p>
        </div>
      )}

      {/* List */}
      {displayed.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          <p className="text-4xl mb-3">📋</p>
          <p>{tab === 'open' ? 'Nenhuma operação aberta' : 'Nenhuma operação fechada'}</p>
          {tab === 'open' && <p className="text-sm mt-1">Toque em "+ Nova" para adicionar</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((op) => (
            <OperationRow
              key={op.id}
              op={op}
              onClose={(o) => setClosingOp(o)}
              onDelete={handleDelete}
              onEditPrice={(o) => setEditingOp(o)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
