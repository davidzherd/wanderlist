import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Camera,
  Compass,
  Download,
  GripVertical,
  Hotel,
  LogIn,
  MapPin,
  Moon,
  Plane,
  Sparkles,
  Star,
  Sun,
  UserPlus,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { LandingMiniMap } from '../components/LandingMiniMap'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../hooks/useTheme'

export function LandingView() {
  const { user, isInitializing } = useAuth()
  const { theme, toggleTheme } = useTheme()

  if (!isInitializing && user) return <Navigate to="/map" replace />

  return (
    <div className="min-h-screen w-full overflow-x-hidden text-ink dark:text-mist-light">
      <header className="glass-panel sticky top-0 z-[500] flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo className="h-8 w-8" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="rounded-full p-2 text-ink/70 transition-colors hover:bg-black/5 dark:text-mist-light/70 dark:hover:bg-white/10"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link
            to="/auth"
            state={{ mode: 'login' }}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-black/5 dark:text-mist-light/70 dark:hover:bg-white/10"
          >
            <LogIn size={16} />
            <span className="hidden sm:inline">Sign in</span>
          </Link>
          <Link
            to="/auth"
            state={{ mode: 'register' }}
            className="flex items-center gap-1.5 rounded-full bg-harbor px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 sm:px-4"
          >
            <UserPlus size={16} />
            <span className="hidden sm:inline">Get started</span>
            <span className="sm:hidden">Start</span>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-mist-light dark:bg-ink">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-harbor/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-brass/20 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-28">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-harbor/10 px-3 py-1 text-xs font-semibold text-harbor dark:bg-harbor-light/10 dark:text-harbor-light">
              <Compass size={14} /> Your travel bucket list, finally organized
            </span>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-ink dark:text-mist-light sm:text-5xl">
              Turn "someday" into a <span className="text-harbor">real itinerary</span>
            </h1>
            <p className="mt-4 max-w-lg text-base text-ink/70 dark:text-mist-light/70 sm:text-lg">
              GoingRoam is where you save every place you want to go, then turn the ones you're
              serious about into day-by-day trips — pins on a map, drag-and-drop planning, and
              photos that make it feel real.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/auth"
                state={{ mode: 'register' }}
                className="flex items-center gap-2 rounded-full bg-harbor px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                <UserPlus size={16} /> Get started free
              </Link>
              <Link
                to="/auth"
                state={{ mode: 'login' }}
                className="flex items-center gap-2 rounded-full bg-black/5 px-6 py-3 text-sm font-semibold text-ink/80 transition-colors hover:bg-black/10 dark:bg-white/5 dark:text-mist-light/80 dark:hover:bg-white/10"
              >
                I already have an account
              </Link>
            </div>
          </div>

          <HeroMapMockup theme={theme} />
        </div>
      </section>

      {/* Features */}
      <section className="bg-mist dark:bg-ink-light">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-14 text-center">
            <h2 className="font-display text-3xl font-semibold text-ink dark:text-mist-light">
              Everything you need to go from wish list to trip
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-ink/60 dark:text-mist-light/60">
              No spreadsheets, no scattered notes — just one place for every place.
            </p>
          </div>

          <div className="flex flex-col gap-20">
            <FeatureRow
              eyebrow="Bucket list"
              title="Save every place on one map"
              description="Drop a pin anywhere in the world, rate how badly you want to go with a 5-star priority, and filter your list by name or country. Every location gets its own photo, so your bucket list actually looks like a trip you're dreaming about."
              image={<MapFeatureMockup theme={theme} />}
            />
            <FeatureRow
              reverse
              eyebrow="Trip builder"
              title="Plan it out, day by day"
              description="Turn a saved location — or anywhere else — into a real itinerary. Drag and drop stops between days, add flights, trains, taxis, and hotels alongside your locations, and reorder everything until the trip feels right."
              image={<ItineraryFeatureMockup />}
            />
            <FeatureRow
              eyebrow="Photos"
              title="Bring every stop to life"
              description="Upload your own photo, or let GoingRoam find one for you automatically. No location ever has to sit behind a blank placeholder."
              image={<PhotosFeatureMockup />}
            />
            <FeatureRow
              reverse
              eyebrow="Take it with you"
              title="Export a trip you can actually use"
              description="Once a trip is planned, export the full day-by-day itinerary as a PDF — ready to share with travel companions or pull up offline when you're on the road."
              image={<ExportFeatureMockup />}
            />
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-mist-light dark:bg-ink">
        <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="glass-panel flex flex-col items-center gap-4 rounded-3xl p-10 text-center">
            <Sparkles className="text-brass" size={28} />
            <h2 className="font-display text-2xl font-semibold text-ink dark:text-mist-light sm:text-3xl">
              Start your list in under a minute
            </h2>
            <p className="max-w-md text-ink/70 dark:text-mist-light/70">
              It's free to use — no credit card, no commitment. Just a place to keep track of every
              trip you keep meaning to take.
            </p>
            <Link
              to="/auth"
              state={{ mode: 'register' }}
              className="mt-2 flex items-center gap-2 rounded-full bg-harbor px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <UserPlus size={16} /> Create your free account
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/5 bg-mist px-4 py-8 text-center text-sm text-ink/50 dark:border-white/10 dark:bg-ink-light dark:text-mist-light/50 sm:px-6">
        <Logo className="mx-auto mb-2 h-6 w-6" showWordmark={false} />
        <p>GoingRoam — plan the trips you keep meaning to take.</p>
      </footer>
    </div>
  )
}

function FeatureRow({
  eyebrow,
  title,
  description,
  image,
  reverse = false,
}: {
  eyebrow: string
  title: string
  description: string
  image: ReactNode
  reverse?: boolean
}) {
  return (
    <div
      className={`grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-14 ${
        reverse ? 'lg:[&>*:first-child]:order-2' : ''
      }`}
    >
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-harbor dark:text-harbor-light">
          {eyebrow}
        </span>
        <h3 className="mt-2 font-display text-2xl font-semibold text-ink dark:text-mist-light">{title}</h3>
        <p className="mt-3 text-ink/70 dark:text-mist-light/70">{description}</p>
      </div>
      <div>{image}</div>
    </div>
  )
}

function MockCard({ children }: { children: ReactNode }) {
  return (
    <div className="glass-panel mx-auto w-full max-w-md rounded-2xl p-4 shadow-glass sm:p-5">{children}</div>
  )
}

function HeroMapMockup({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="glow-border animate-glow-pulse" />
      <div className="glass-panel relative z-10 overflow-hidden rounded-2xl p-3 shadow-glass">
        <div className="relative h-64 w-full overflow-hidden rounded-xl">
          <LandingMiniMap theme={theme} center={[37.6, 22.5]} zoom={5} />
          <PinDot className="left-[30%] top-[28%] z-10" />
          <PinDot className="left-[58%] top-[52%] z-10" pulse />
          <PinDot className="left-[72%] top-[68%] z-10" />

          <div className="absolute bottom-3 left-3 z-10 max-w-[65%] rounded-xl bg-white/90 px-3 py-2 shadow-md dark:bg-ink/90">
            <p className="text-xs font-semibold text-ink dark:text-mist-light">Santorini, Greece</p>
            <div className="mt-0.5 flex items-center gap-0.5">
              {[1, 2, 3, 4].map((s) => (
                <Star key={s} size={10} className="fill-brass text-brass" />
              ))}
              <Star size={10} className="text-ink/20 dark:text-mist-light/20" />
            </div>
          </div>
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-ink/40 dark:text-mist-light/40">
          Map data &copy; OpenStreetMap contributors &copy; CARTO
        </p>
      </div>
    </div>
  )
}

function PinDot({ className = '', pulse = false }: { className?: string; pulse?: boolean }) {
  return (
    <span className={`absolute -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${className}`}>
      {pulse && <span className="absolute inset-0 -m-2 animate-ping rounded-full bg-brass/60" />}
      <span className="relative flex h-6 w-6 items-center justify-center rounded-full border-[2.5px] border-white bg-brass dark:border-ink-light">
        <MapPin size={13} className="text-white" strokeWidth={2.5} />
      </span>
    </span>
  )
}

function MapFeatureMockup({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <MockCard>
      <div className="relative h-52 w-full overflow-hidden rounded-xl">
        <LandingMiniMap theme={theme} center={[20, 10]} zoom={2} />
        <PinDot className="left-[25%] top-[35%] z-10" />
        <PinDot className="left-[60%] top-[60%] z-10" pulse />
        <PinDot className="left-[80%] top-[30%] z-10" />
      </div>
      <p className="mt-1.5 px-1 text-[10px] text-ink/40 dark:text-mist-light/40">
        Map data &copy; OpenStreetMap contributors &copy; CARTO
      </p>
    </MockCard>
  )
}

function ItineraryFeatureMockup() {
  const days = [
    { label: 'Day 1', items: [{ icon: Plane, text: 'Flight to Lisbon' }, { icon: MapPin, text: 'Alfama walk' }] },
    { label: 'Day 2', items: [{ icon: Hotel, text: 'Hotel check-in' }, { icon: MapPin, text: 'Belém Tower' }] },
    { label: 'Day 3', items: [{ icon: MapPin, text: 'Sintra day trip' }] },
  ]
  return (
    <MockCard>
      <div className="flex flex-col gap-2.5">
        {days.map((day) => (
          <div key={day.label} className="flex items-stretch gap-2.5 rounded-xl bg-black/5 p-2.5 dark:bg-white/5">
            <span className="flex w-14 shrink-0 items-center justify-center rounded-lg bg-harbor/15 text-xs font-semibold text-harbor dark:bg-harbor-light/15 dark:text-harbor-light">
              {day.label}
            </span>
            <div className="flex flex-1 flex-col gap-1.5">
              {day.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-xs text-ink dark:bg-black/30 dark:text-mist-light"
                >
                  <item.icon size={12} className="shrink-0 text-harbor dark:text-harbor-light" />
                  <span className="truncate">{item.text}</span>
                  <GripVertical size={12} className="ml-auto shrink-0 text-ink/30 dark:text-mist-light/30" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </MockCard>
  )
}

// Real photos from GoingRoam's own Cloudinary account (same cloud VITE_CLOUDINARY_CLOUD_NAME
// uploads go to), so the showcase reflects actual photos rather than stock placeholders.
function cloudinaryPhoto(publicId: string): string {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  return `https://res.cloudinary.com/${cloudName}/image/upload/c_fill,g_auto,w_300,h_300,q_auto,f_auto/${publicId}`
}

function PhotosFeatureMockup() {
  return (
    <MockCard>
      <div className="grid grid-cols-2 gap-2.5">
        <img
          src={cloudinaryPhoto('_MG_0382_a8a9b0')}
          alt="Travel photo"
          loading="lazy"
          className="aspect-square rounded-xl object-cover"
        />
        <img
          src={cloudinaryPhoto('_MG_7368-HDR_snemei')}
          alt="Travel photo"
          loading="lazy"
          className="aspect-square rounded-xl object-cover"
        />
        <img
          src={cloudinaryPhoto('_MG_8114_hdr_cxr0oa')}
          alt="Travel photo"
          loading="lazy"
          className="aspect-square rounded-xl object-cover"
        />
        <div className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-ink/15 text-ink/40 dark:border-mist-light/15 dark:text-mist-light/40">
          <Camera size={20} />
          <span className="text-[10px] font-medium">Auto photo</span>
        </div>
      </div>
    </MockCard>
  )
}

function ExportFeatureMockup() {
  return (
    <MockCard>
      <div className="rounded-xl bg-white/70 p-4 dark:bg-black/30">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-sm font-semibold text-ink dark:text-mist-light">Portugal Trip.pdf</span>
          <span className="flex items-center gap-1.5 rounded-full bg-harbor px-2.5 py-1 text-[10px] font-semibold text-white">
            <Download size={11} /> Export
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="h-2 w-4/5 rounded-full bg-ink/10 dark:bg-mist-light/15" />
          <div className="h-2 w-full rounded-full bg-ink/10 dark:bg-mist-light/15" />
          <div className="h-2 w-3/5 rounded-full bg-ink/10 dark:bg-mist-light/15" />
          <div className="mt-2 h-2 w-4/5 rounded-full bg-ink/10 dark:bg-mist-light/15" />
          <div className="h-2 w-2/3 rounded-full bg-ink/10 dark:bg-mist-light/15" />
        </div>
      </div>
    </MockCard>
  )
}
