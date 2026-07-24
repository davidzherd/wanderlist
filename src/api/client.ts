const MOCK_DELAY_MS = 300

export function mockDelay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_DELAY_MS))
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeStore<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

/** Mock JWT — base64 payload only, sufficient for local session simulation. */
export function makeMockToken(username: string): string {
  const header = btoa(JSON.stringify({ alg: 'mock', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ sub: username, iat: Date.now() }))
  return `${header}.${payload}.mocksignature`
}

export const STORAGE_KEYS = {
  session: 'wanderlist.session',
  locations: 'wanderlist.locations',
  trips: 'wanderlist.trips',
  seeded: 'wanderlist.seeded',
} as const
