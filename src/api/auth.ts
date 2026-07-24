import { UserSchema, type User } from '../types/user'
import { ApiError, makeMockToken, mockDelay, readStore, writeStore, STORAGE_KEYS } from './client'

interface StoredAccount {
  username: string
  password: string
}

const ACCOUNTS_KEY = 'wanderlist.accounts'

export async function login(username: string, password: string): Promise<User> {
  const accounts = readStore<StoredAccount[]>(ACCOUNTS_KEY, [])
  const account = accounts.find((a) => a.username === username)

  if (!account || account.password !== password) {
    throw new ApiError('Invalid username or password')
  }

  const user = UserSchema.parse({ username, token: makeMockToken(username) })
  writeStore(STORAGE_KEYS.session, user)
  return mockDelay(user)
}

export async function register(username: string, password: string): Promise<User> {
  const accounts = readStore<StoredAccount[]>(ACCOUNTS_KEY, [])
  if (accounts.some((a) => a.username === username)) {
    throw new ApiError('Username is already taken')
  }

  writeStore(ACCOUNTS_KEY, [...accounts, { username, password }])

  const user = UserSchema.parse({ username, token: makeMockToken(username) })
  writeStore(STORAGE_KEYS.session, user)
  return mockDelay(user)
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
