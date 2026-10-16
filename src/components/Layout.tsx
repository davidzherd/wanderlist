import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Map, Luggage, Moon, Sun, LogOut, Settings } from 'lucide-react'
import { Logo } from './Logo'
import { SessionExpiredModal } from './SessionExpiredModal'
import { useAuth } from '../context/AuthContext'
import { NotificationProvider } from '../context/NotificationContext'
import { useTheme } from '../hooks/useTheme'

const NAV_ITEMS = [
  { to: '/map', label: 'Map', icon: Map, end: true },
  { to: '/trips', label: 'Trips', icon: Luggage, end: false },
]

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const routerLocation = useLocation()

  const navRef = useRef<HTMLElement>(null)
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

  // Undefined off the nav's own pages (e.g. /settings) — the sliding indicator then hides instead of sitting on Map.
  const activeTo = NAV_ITEMS.find(({ to, end }) =>
    end ? routerLocation.pathname === to : routerLocation.pathname.startsWith(to),
  )?.to

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const el = activeTo ? itemRefs.current[activeTo] : null
      const nav = navRef.current
      if (!el || !nav) {
        setIndicator(null)
        return
      }
      const elRect = el.getBoundingClientRect()
      const navRect = nav.getBoundingClientRect()
      setIndicator({ left: elRect.left - navRect.left, width: elRect.width })
    }
    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [activeTo])

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-mist-light text-ink dark:bg-ink dark:text-mist-light">
      <header className="glass-panel z-[500] flex shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo className="h-8 w-8" />

        <nav ref={navRef} className="relative flex items-center gap-1 rounded-full bg-black/5 p-1 dark:bg-white/5">
          {indicator && (
            <span
              aria-hidden="true"
              className="absolute inset-y-1 rounded-full bg-harbor shadow-sm transition-[left,width] duration-300 ease-[cubic-bezier(0.65,0,0.35,1)]"
              style={{ left: indicator.left, width: indicator.width }}
            />
          )}
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              ref={(el) => {
                itemRefs.current[to] = el
              }}
              className={({ isActive }) =>
                `relative z-10 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-300 ${
                  isActive
                    ? 'text-white'
                    : 'text-ink/70 hover:bg-black/5 dark:text-mist-light/70 dark:hover:bg-white/10'
                }`
              }
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <NavLink
            to="/settings"
            aria-label="Settings"
            title="Settings"
            className={({ isActive }) =>
              `rounded-full p-2 transition-colors ${
                isActive
                  ? 'bg-harbor/15 text-harbor dark:bg-harbor/25 dark:text-harbor-light'
                  : 'text-ink/70 hover:bg-black/5 dark:text-mist-light/70 dark:hover:bg-white/10'
              }`
            }
          >
            <Settings size={18} />
          </NavLink>
          {/* Phones/tablets: theme and sign-out live on the Settings page instead (its Account section). */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
            className="hidden rounded-full p-2 text-ink/70 transition-colors hover:bg-black/5 dark:text-mist-light/70 dark:hover:bg-white/10 lg:block"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user && (
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
              className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-black/5 dark:text-mist-light/70 dark:hover:bg-white/10 lg:flex"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">{user.name}</span>
            </button>
          )}
        </div>
      </header>

      <main className="relative flex-1 overflow-hidden">
        <NotificationProvider>{children}</NotificationProvider>
      </main>

      <SessionExpiredModal />
    </div>
  )
}
