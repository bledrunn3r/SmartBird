import { NavLink, Outlet } from 'react-router-dom'
import { StatusBar } from './StatusBar'
import { useStatus } from '../hooks/useStatus'

export function Layout() {
  const { status, connected } = useStatus()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white px-6 py-4 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold leading-none">SmartBird</h1>
            <p className="text-green-300 text-xs mt-0.5">ESP-RZXe · 8 zones</p>
          </div>
          <nav className="flex gap-1">
            {[
              { to: '/', label: 'Tableau de bord' },
              { to: '/programs', label: 'Programmes' },
              { to: '/schedules', label: 'Planifications' },
              { to: '/planning', label: 'Planning smart' },
              { to: '/history', label: 'Historique' },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-green-600 text-white'
                      : 'text-green-100 hover:bg-green-600'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <StatusBar status={status} connected={connected} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
