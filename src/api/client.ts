const MOCK_DELAY_MS = 300

export function mockDelay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_DELAY_MS))
}

export class ApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
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

export const STORAGE_KEYS = {
  session: 'wanderlist.session',
  trips: 'wanderlist.trips',
} as const

export const XANO_AUTH_URL = `${import.meta.env.VITE_XANO_API_BASE}/api:${import.meta.env.VITE_XANO_AUTH_GROUP}`
export const XANO_LOCATIONS_URL = `${import.meta.env.VITE_XANO_API_BASE}/api:${import.meta.env.VITE_XANO_LOCATIONS_GROUP}`

interface XanoRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string
}

/** Convert a Xano `timestamp` field (epoch ms or ISO string) to an ISO string. */
export function toIsoString(value: string | number): string {
  return typeof value === 'number' ? new Date(value).toISOString() : value
}

export async function xanoRequest<T>(baseUrl: string, path: string, options: XanoRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Could not reach the server. Check your connection.')
  }

  let data: unknown = null
  const text = await response.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data && typeof (data as { message?: unknown }).message === 'string'
        ? (data as { message: string }).message
        : 'Something went wrong. Please try again.'
    throw new ApiError(message, response.status)
  }

  return data as T
}
