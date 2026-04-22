import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Building2, ArrowLeftRight, BarChart2, Settings } from 'lucide-react'

const TABS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/exchanges', icon: Building2, label: 'Corretoras' },
  { to: '/operations', icon: ArrowLeftRight, label: 'Operações' },
  { to: '/statistics', icon: BarChart2, label: 'Estatísticas' },
  { to: '/settings', icon: Settings, label: 'Config' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700/60 flex items-stretch safe-bottom max-w-lg mx-auto">
      {TABS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors ${
              isActive ? 'text-violet-400' : 'text-slate-500 hover:text-slate-300'
            }`
          }
        >
          <Icon size={20} strokeWidth={1.8} />
          <span className="text-[10px]">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
