import { useState } from 'react'
import toast from 'react-hot-toast'
import { Eye, EyeOff, CheckCircle, XCircle, Download, Trash2, Wifi } from 'lucide-react'
import { getConfig, saveConfig, getHistory, clearAllData, exportCSV, getRefreshInterval, saveRefreshInterval } from '../services/storage'
import { fetchExchangeBalance } from '../services/exchanges'
import Spinner from '../components/Spinner'
import type { Config, ExchangeId, RefreshInterval } from '../types'

interface ExchangeFieldProps {
  id: ExchangeId
  name: string
  config: Config
  onChange: (id: ExchangeId, field: 'apiKey' | 'secret', value: string) => void
  onToggle: (id: ExchangeId) => void
  onTest: (id: ExchangeId) => void
  testing: boolean
  testResult: 'ok' | 'fail' | null
}

function ExchangeField({ id, name, config, onChange, onToggle, onTest, testing, testResult }: ExchangeFieldProps) {
  const [showSecret, setShowSecret] = useState(false)
  const cfg = config[id]

  return (
    <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-white">{name}</span>
        <button
          onClick={() => onToggle(id)}
          className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${cfg.enabled ? 'bg-violet-600' : 'bg-slate-600'}`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform mt-0.5 ${cfg.enabled ? 'translate-x-5.5' : 'translate-x-0.5'}`}
          />
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <label className="text-xs text-slate-500 block mb-1">API Key</label>
          <input
            type="text"
            value={cfg.apiKey}
            onChange={(e) => onChange(id, 'apiKey', e.target.value)}
            placeholder="Cole sua API Key aqui"
            className="w-full bg-slate-700/60 border border-slate-600/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Secret</label>
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              value={cfg.secret}
              onChange={(e) => onChange(id, 'secret', e.target.value)}
              placeholder="Cole seu Secret aqui"
              className="w-full bg-slate-700/60 border border-slate-600/50 rounded-xl px-3 py-2.5 pr-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={() => onTest(id)}
        disabled={testing || !cfg.apiKey || !cfg.secret}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700/60 disabled:opacity-40 text-sm transition-colors"
      >
        {testing ? (
          <Spinner size={16} />
        ) : testResult === 'ok' ? (
          <CheckCircle size={16} className="text-emerald-400" />
        ) : testResult === 'fail' ? (
          <XCircle size={16} className="text-red-400" />
        ) : (
          <Wifi size={16} />
        )}
        {testing ? 'Testando…' : testResult === 'ok' ? 'Conectado!' : testResult === 'fail' ? 'Falhou' : 'Testar Conexão'}
      </button>
    </div>
  )
}

const REFRESH_PRESETS: { label: string; value: RefreshInterval; desc: string }[] = [
  { label: 'Rápido', value: 20, desc: '20s' },
  { label: 'Balanceado', value: 60, desc: '60s' },
  { label: 'Econômico', value: 120, desc: '120s' },
  { label: 'Seguro', value: 240, desc: '240s' },
]

export default function Settings() {
  const [config, setConfig] = useState<Config>(() => getConfig())
  const [refreshInterval, setRefreshIntervalState] = useState<RefreshInterval>(() => getRefreshInterval())
  const [testing, setTesting] = useState<Partial<Record<ExchangeId, boolean>>>({})
  const [testResults, setTestResults] = useState<Partial<Record<ExchangeId, 'ok' | 'fail'>>>({})
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const EXCHANGE_NAMES: Record<ExchangeId, string> = { bingx: 'BingX', gate: 'Gate.io', mexc: 'MEXC' }

  function handleChange(id: ExchangeId, field: 'apiKey' | 'secret', value: string) {
    setConfig((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
    setTestResults((prev) => ({ ...prev, [id]: undefined }))
  }

  function handleToggle(id: ExchangeId) {
    setConfig((prev) => ({
      ...prev,
      [id]: { ...prev[id], enabled: !prev[id].enabled },
    }))
  }

  function handleSave() {
    saveConfig(config)
    saveRefreshInterval(refreshInterval)
    window.dispatchEvent(new StorageEvent('storage', { key: 'aura_refresh_interval' }))
    toast.success('Configurações salvas!')
  }

  async function handleTest(id: ExchangeId) {
    setTesting((prev) => ({ ...prev, [id]: true }))
    setTestResults((prev) => ({ ...prev, [id]: undefined }))
    try {
      const balance = await fetchExchangeBalance(id, config)
      setTestResults((prev) => ({ ...prev, [id]: 'ok' }))
      toast.success(`${EXCHANGE_NAMES[id]}: ${balance.toFixed(2)} USDT`)
    } catch (err: any) {
      setTestResults((prev) => ({ ...prev, [id]: 'fail' }))
      toast.error(`${EXCHANGE_NAMES[id]}: ${err.message ?? 'Erro de conexão'}`)
    } finally {
      setTesting((prev) => ({ ...prev, [id]: false }))
    }
  }

  function handleExport() {
    const records = getHistory()
    if (records.length === 0) {
      toast.error('Nenhum registro para exportar')
      return
    }
    exportCSV(records)
    toast.success('CSV exportado!')
  }

  function handleClear() {
    clearAllData()
    setConfig(getConfig())
    setShowClearConfirm(false)
    toast.success('Dados apagados')
  }

  return (
    <div className="flex-1 px-4 pt-6 pb-28 space-y-4">
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-widest">Configurações</p>
        <h1 className="text-xl font-bold text-white">API Keys</h1>
      </div>

      <p className="text-xs text-slate-500 bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
        Suas chaves são salvas apenas no seu dispositivo (localStorage). Nunca são enviadas a nenhum servidor externo.
      </p>

      {/* Auto-refresh */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4 space-y-3">
        <p className="font-semibold text-white">Taxa de Atualização</p>
        <div className="grid grid-cols-2 gap-2">
          {REFRESH_PRESETS.map(({ label, value, desc }) => (
            <button
              key={value}
              onClick={() => setRefreshIntervalState(value)}
              className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-colors border ${
                refreshInterval === value
                  ? 'bg-violet-600 border-violet-500 text-white'
                  : 'bg-slate-700/40 border-slate-600/50 text-slate-400 hover:text-white'
              }`}
            >
              <p>{label}</p>
              <p className="text-[10px] opacity-70">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {(['bingx', 'gate', 'mexc'] as ExchangeId[]).map((id) => (
        <ExchangeField
          key={id}
          id={id}
          name={EXCHANGE_NAMES[id]}
          config={config}
          onChange={handleChange}
          onToggle={handleToggle}
          onTest={handleTest}
          testing={testing[id] ?? false}
          testResult={testResults[id] ?? null}
        />
      ))}

      <button
        onClick={handleSave}
        className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors"
      >
        Salvar Configurações
      </button>

      {/* Dados */}
      <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4 space-y-3">
        <p className="font-semibold text-white">Dados Locais</p>
        <button
          onClick={handleExport}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700/60 text-sm transition-colors"
        >
          <Download size={16} />
          Exportar Histórico CSV
        </button>

        {!showClearConfirm ? (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 text-sm transition-colors"
          >
            <Trash2 size={16} />
            Limpar Todos os Dados
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-center text-red-300">Confirmar? Isso apaga histórico e API keys.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm hover:bg-slate-700/60 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleClear}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-slate-600 pb-2">Aura Tracker v1.0.0</p>
    </div>
  )
}
