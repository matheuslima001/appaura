import { NavLink } from 'react-router-dom'
import { LayoutDashboard, History, BarChart2, Settings } from 'lucide-react'

const TABS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/history', icon: History, label: 'Histórico' },
  { to: '/charts', icon: BarChart2, label: 'Gráficos' },
  { to: '/settings', icon: Settings, label: 'Config' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700/60 flex items-stretch safe-bottom">
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
          <Icon size={22} strokeWidth={1.8} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
