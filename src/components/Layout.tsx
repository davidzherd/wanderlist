import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Map, PlusCircle, Luggage, Moon, Sun, LogOut } from 'lucide-react'
import { Logo } from './Logo'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'

const NAV_ITEMS = [
  { to: '/', label: 'Map', icon: Map, end: true },
  { to: '/add-location', label: 'Add', icon: PlusCircle, end: false },
  { to: '/trips', label: 'Trips', icon: Luggage, end: false },
]

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-sand-light text-espresso dark:bg-espresso dark:text-sand-light">
      <header className="glass-panel z-[500] flex shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo className="h-8 w-8" />

        <nav className="flex items-center gap-1 rounded-full bg-black/5 p-1 dark:bg-white/5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-terracotta text-white shadow-sm'
                    : 'text-espresso/70 hover:bg-black/5 dark:text-sand-light/70 dark:hover:bg-white/10'
                }`
              }
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="rounded-full p-2 text-espresso/70 transition-colors hover:bg-black/5 dark:text-sand-light/70 dark:hover:bg-white/10"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user && (
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-espresso/70 transition-colors hover:bg-black/5 dark:text-sand-light/70 dark:hover:bg-white/10"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">{user.username}</span>
            </button>
          )}
        </div>
      </header>

      <main className="relative flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
