import { UserSchema, type User } from '../types/user'
import { readStore, writeStore, STORAGE_KEYS, xanoRequest, XANO_AUTH_URL } from './client'

interface AuthTokenResponse {
  authToken: string
  user_id: number
}

interface MeResponse {
  id: number
  name: string
  email: string
}

async function buildUser(authToken: string): Promise<User> {
  const me = await xanoRequest<MeResponse>(XANO_AUTH_URL, '/auth/me', {
    method: 'GET',
    token: authToken,
  })
  return UserSchema.parse({ id: me.id, name: me.name, email: me.email, token: authToken })
}

export async function login(email: string, password: string): Promise<User> {
  const { authToken } = await xanoRequest<AuthTokenResponse>(XANO_AUTH_URL, '/auth/login', {
    method: 'POST',
    body: { email, password },
  })

  const user = await buildUser(authToken)
  writeStore(STORAGE_KEYS.session, user)
  return user
}

export async function register(name: string, email: string, password: string): Promise<User> {
  const { authToken } = await xanoRequest<AuthTokenResponse>(XANO_AUTH_URL, '/auth/signup', {
    method: 'POST',
    body: { name, email, password },
  })

  const user = await buildUser(authToken)
  writeStore(STORAGE_KEYS.session, user)
  return user
}

export function getSession(): User | null {
  const raw = readStore<unknown>(STORAGE_KEYS.session, null)
  if (!raw) return null
  const parsed = UserSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEYS.session)
}
