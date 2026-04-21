import Spinner from './Spinner'
import { formatUSDT } from '../utils/format'

interface Props {
  name: string
  balance: number | null
  loading: boolean
  error: string | null
  enabled: boolean
}

const COLORS: Record<string, string> = {
  BingX: 'from-blue-500/20 to-blue-600/5',
  'Gate.io': 'from-green-500/20 to-green-600/5',
  MEXC: 'from-orange-500/20 to-orange-600/5',
}

export default function ExchangeCard({ name, balance, loading, error, enabled }: Props) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${COLORS[name] ?? 'from-slate-700/30 to-slate-800/10'} border border-slate-700/50 p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-300">{name}</span>
        {!enabled && <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">Inativo</span>}
      </div>
      {loading ? (
        <Spinner size={18} />
      ) : error ? (
        <p className="text-xs text-red-400 truncate">{error}</p>
      ) : balance !== null ? (
        <p className="text-xl font-semibold text-white">{formatUSDT(balance)} <span className="text-sm font-normal text-slate-400">USDT</span></p>
      ) : (
        <p className="text-sm text-slate-500">—</p>
      )}
    </div>
  )
}
