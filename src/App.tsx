import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { BalancesProvider } from './context/BalancesContext'
import BottomNav from './components/BottomNav'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Exchanges from './pages/Exchanges'
import Operations from './pages/Operations'
import Statistics from './pages/Statistics'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <BalancesProvider>
        <div className="min-h-svh bg-slate-950 text-slate-100 flex flex-col max-w-lg mx-auto relative">
          <main className="flex-1 flex flex-col">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/exchanges" element={<Exchanges />} />
              <Route path="/operations" element={<Operations />} />
              <Route path="/statistics" element={<Statistics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/history" element={<History />} />
            </Routes>
          </main>
          <BottomNav />
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: '#1e293b',
                color: '#f1f5f9',
                border: '1px solid #334155',
                borderRadius: '12px',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: '#10b981', secondary: '#f1f5f9' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#f1f5f9' } },
            }}
          />
        </div>
      </BalancesProvider>
    </BrowserRouter>
  )
}
