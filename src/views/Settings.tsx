import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clipboard, LocateFixed, LogOut, RotateCcw, ShieldAlert, type LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useTheme } from '../hooks/useTheme'
import { usePermission, type AppPermission, type PermissionStatusValue } from '../hooks/usePermission'
import { CurrencySelect } from '../components/CurrencySelect'
import { AlertModal } from '../components/AlertModal'
import { DEFAULT_NOTIFICATIONS, type UserSettings } from '../types/settings'

// Same frosted surface as the rest of the app's glass cards (see AddLocationPopup).
const cardClass =
  'rounded-2xl border border-white/60 bg-white/60 p-4 shadow-glass backdrop-blur-2xl dark:border-white/10 dark:bg-[#333]/65'
const hintClass = 'text-xs text-ink/55 dark:text-mist-light/55'
const secondaryButtonClass =
  'rounded-full border border-black/15 bg-white/70 px-3 py-1.5 text-xs font-medium text-ink transition hover:shadow-md dark:border-white/15 dark:bg-white/10 dark:text-mist-light'

/** Preferences page (/settings). Every change applies and saves immediately — there's no Save button. */
export function SettingsView() {
  const { settings, updateSettings } = useSettings()

  return (
    <div className="trip-scroll h-full overflow-y-auto bg-mist-light dark:bg-ink">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6 lg:py-10">
        <h1 className="font-display text-xl font-semibold text-ink dark:text-mist-light">Settings</h1>

        <section className={cardClass} aria-labelledby="settings-trips">
          <SectionTitle id="settings-trips">Trips</SectionTitle>
          <Row label="Days start" hint="How each day appears when you open a trip">
            <Segmented
              ariaLabel="Days start"
              value={settings.daysStartCollapsed ? 'collapsed' : 'open'}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'collapsed', label: 'Collapsed' },
              ]}
              onChange={(value) => updateSettings({ daysStartCollapsed: value === 'collapsed' })}
            />
          </Row>
          <Row label="Default currency" hint="New trips start in this currency">
            <CurrencySelect
              value={settings.defaultCurrency}
              onChange={(code) => updateSettings({ defaultCurrency: code })}
              ariaLabel="Default currency"
            />
          </Row>
        </section>

        <section className={cardClass} aria-labelledby="settings-notifications">
          <SectionTitle id="settings-notifications">Notifications</SectionTitle>
          <NotificationOptions value={settings.notifications} onChange={(notifications) => updateSettings({ notifications })} />
          <button
            type="button"
            onClick={() => updateSettings({ notifications: DEFAULT_NOTIFICATIONS })}
            className="mt-1 flex items-center gap-1.5 text-xs font-medium text-harbor hover:underline dark:text-harbor-light"
          >
            <RotateCcw size={13} /> Reset to default
          </button>
        </section>

        <section className={cardClass} aria-labelledby="settings-permissions">
          <SectionTitle id="settings-permissions">Permissions</SectionTitle>
          <PermissionRow permission="geolocation" icon={LocateFixed} label="Location" hint="Shows you on the map" />
          <PermissionRow permission="clipboard-read" icon={Clipboard} label="Clipboard" hint="Paste photos into a location" />
        </section>

        {/* Phones/tablets only: the header has no room for these there, so they live here. */}
        <AccountSection />
      </div>
    </div>
  )
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mb-2 font-display text-sm font-semibold text-ink dark:text-mist-light">
      {children}
    </h2>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-black/10 py-3 first-of-type:border-t-0 dark:border-white/10">
      <div className="min-w-0">
        <p className="text-sm text-ink dark:text-mist-light">{label}</p>
        {hint && <p className={hintClass}>{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function Segmented<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
}: {
  ariaLabel: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-full bg-black/5 p-1 dark:bg-white/10">
      {options.map((opt) => {
        const isSelected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              isSelected
                ? 'bg-harbor text-white shadow-sm'
                : 'text-ink/70 hover:bg-white/50 dark:text-mist-light/70 dark:hover:bg-white/10'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

const NOTIFICATION_OPTIONS: { value: UserSettings['notifications']; label: string; hint: string }[] = [
  { value: 'all', label: 'All notifications', hint: 'Every confirmation and error' },
  { value: 'locations', label: 'Only location notifications', hint: 'Errors, plus bucket-list locations added, updated or removed' },
]

function NotificationOptions({
  value,
  onChange,
}: {
  value: UserSettings['notifications']
  onChange: (value: UserSettings['notifications']) => void
}) {
  return (
    <div role="radiogroup" aria-label="Notifications" className="mb-2 flex flex-col gap-2">
      {NOTIFICATION_OPTIONS.map((opt) => {
        const isSelected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition duration-150 ${
              isSelected
                ? 'border-harbor bg-harbor/5 dark:bg-harbor/15'
                : 'border-black/10 hover:scale-[1.01] hover:shadow-md dark:border-white/10'
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                isSelected ? 'border-[5px] border-harbor' : 'border-ink/30 dark:border-mist-light/30'
              }`}
            />
            <span>
              <span className="block text-sm text-ink dark:text-mist-light">{opt.label}</span>
              <span className={hintClass}>{opt.hint}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

const STATUS_PILL: Record<PermissionStatusValue, { label: string; className: string }> = {
  granted: { label: 'Allowed', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  prompt: { label: 'Not asked yet', className: 'bg-black/5 text-ink/60 dark:bg-white/10 dark:text-mist-light/60' },
  denied: { label: 'Blocked', className: 'bg-red-500/15 text-red-700 dark:text-red-300' },
  'per-use': { label: 'Asked when you paste', className: 'bg-black/5 text-ink/60 dark:bg-white/10 dark:text-mist-light/60' },
  unknown: { label: 'Not checked', className: 'bg-black/5 text-ink/60 dark:bg-white/10 dark:text-mist-light/60' },
}

const UNBLOCK_STEPS: Record<AppPermission, { title: string; body: string }> = {
  geolocation: {
    title: 'Allow location access',
    body: "Your browser is blocking location for this site, and it won't ask again by itself. Open the site settings (the icon next to the address bar), set Location to Allow, then reload the page. On a phone, also check that location services are on for your browser.",
  },
  'clipboard-read': {
    title: 'Allow clipboard access',
    body: "Your browser is blocking clipboard access for this site, and it won't ask again by itself. Open the site settings (the icon next to the address bar), set Clipboard to Allow, then reload the page.",
  },
}

function PermissionRow({
  permission,
  icon: Icon,
  label,
  hint,
}: {
  permission: AppPermission
  icon: LucideIcon
  label: string
  hint: string
}) {
  const { status, request } = usePermission(permission)
  const [showSteps, setShowSteps] = useState(false)
  const pill = STATUS_PILL[status]
  const steps = UNBLOCK_STEPS[permission]

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-black/10 py-3 first-of-type:border-t-0 dark:border-white/10">
      <div className="flex min-w-0 items-start gap-2">
        <Icon size={16} className="mt-0.5 shrink-0 text-harbor dark:text-harbor-light" />
        <div>
          <p className="text-sm text-ink dark:text-mist-light">{label}</p>
          <p className={hintClass}>{hint}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${pill.className}`}>{pill.label}</span>
        {(status === 'prompt' || status === 'unknown') && (
          <button
            type="button"
            onClick={() => void request()}
            className="rounded-full bg-harbor px-3 py-1.5 text-xs font-semibold text-white transition hover:shadow-md"
          >
            Allow
          </button>
        )}
        {status === 'denied' && (
          <button type="button" onClick={() => setShowSteps(true)} className={secondaryButtonClass}>
            How to allow
          </button>
        )}
      </div>
      {showSteps && (
        <AlertModal
          icon={<ShieldAlert size={32} className="text-harbor dark:text-harbor-light" />}
          title={steps.title}
          confirmLabel="Got it"
          onConfirm={() => setShowSteps(false)}
          onDismiss={() => setShowSteps(false)}
        >
          {steps.body}
        </AlertModal>
      )}
    </div>
  )
}

function AccountSection() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  return (
    <section className={`${cardClass} lg:hidden`} aria-labelledby="settings-account">
      <SectionTitle id="settings-account">Account</SectionTitle>
      <Row label="Theme">
        <Segmented
          ariaLabel="Theme"
          value={theme}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          onChange={(value) => value !== theme && toggleTheme()}
        />
      </Row>
      {user && (
        <div className="border-t border-dashed border-black/10 pt-3 dark:border-white/10">
          <p className="mb-3 text-sm text-ink dark:text-mist-light">
            Signed in as <span className="font-semibold">{user.name}</span>
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-red-300 text-sm font-medium text-red-600 transition hover:shadow-md dark:border-red-400/40 dark:text-red-400"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </section>
  )
}
