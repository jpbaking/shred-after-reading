export interface ApiUser {
  id: string
  email: string
  name: string | null
  emailVerified: boolean
  isAdmin: boolean
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseError(response: Response, fallback: string): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: string }
    return new ApiError(response.status, body.error || fallback)
  } catch {
    return new ApiError(response.status, fallback)
  }
}

async function requestJson<T>(input: string, init: RequestInit, fallback: string): Promise<T> {
  const response = await fetch(input, init)
  if (!response.ok) {
    throw await parseError(response, fallback)
  }
  return (await response.json()) as T
}

export function register(data: {
  email: string
  password: string
  name?: string
}): Promise<{ user: Pick<ApiUser, 'id' | 'email' | 'name'>; emailSent: boolean }> {
  return requestJson(
    '/api/auth/register',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Registration failed',
  )
}

export function login(data: {
  email: string
  password: string
  rememberMe: boolean
}): Promise<{ user: ApiUser; expiresAt: string }> {
  return requestJson(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    'Login failed',
  )
}

export function verifyEmail(token: string): Promise<{ verified: boolean; email: string }> {
  return requestJson(
    `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
    { method: 'GET' },
    'Verification failed',
  )
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' })
}

export async function getMe(): Promise<ApiUser | null> {
  const response = await fetch('/api/auth/me')
  if (!response.ok) {
    return null
  }
  const body = (await response.json()) as { user: ApiUser }
  return body.user
}

export interface ExpiryInput {
  amount: number
  unit: 'minutes' | 'hours' | 'days' | 'months' | 'year'
}

export interface SarMetadata {
  id: string
  passwordRequired: boolean
  isMarkdown: boolean
  createdAt: string
  expiresAt: string | null
}

export interface OwnedSar extends SarMetadata {
  contentPreview: string
}

export interface SarWithContent extends SarMetadata {
  content: string
}

export interface AdminUserSummary {
  id: string
  email: string
  name: string | null
  emailVerified: boolean
  isAdmin: boolean
  isBanned: boolean
  createdAt: string
  sarStats: {
    total: number
    active: number
    expired: number
    deleted: number
  }
}

export type AdminSarStatus = 'all' | 'active' | 'expired' | 'deleted'

export interface AdminSarSummary {
  id: string
  owner: {
    id: string
    email: string
    name: string | null
  }
  sharePath: string
  passwordRequired: boolean
  isMarkdown: boolean
  createdAt: string
  expiresAt: string | null
  deletedAt: string | null
  status: Exclude<AdminSarStatus, 'all'>
  contentPreview: string
}

export interface AdminSarDetail extends AdminSarSummary {
  content: string
}

export interface AdminSettingsSummary {
  globalExpiryLimit: ExpiryInput
  hardCap: ExpiryInput
}

function jsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }
}

export function createSar(data: {
  content: string
  isMarkdown?: boolean
  password?: string
  expiry?: ExpiryInput
}): Promise<{ sar: SarMetadata }> {
  return requestJson('/api/sars', jsonInit('POST', data), 'Failed to create SAR')
}

export function listSars(): Promise<{ sars: OwnedSar[] }> {
  return requestJson('/api/sars', jsonInit('GET'), 'Failed to load SARs')
}

export function getOwnedSar(id: string): Promise<{ sar: SarWithContent }> {
  return requestJson(
    `/api/sars/${encodeURIComponent(id)}`,
    jsonInit('GET'),
    'Failed to load SAR',
  )
}

export function changeSarExpiry(id: string, expiry: ExpiryInput): Promise<{ sar: SarMetadata }> {
  return requestJson(
    `/api/sars/${encodeURIComponent(id)}/expiry`,
    jsonInit('PATCH', { expiry }),
    'Failed to change expiry',
  )
}

export function setSarPassword(id: string, password: string): Promise<{ sar: SarMetadata }> {
  return requestJson(
    `/api/sars/${encodeURIComponent(id)}/password`,
    jsonInit('PUT', { password }),
    'Failed to set password',
  )
}

export function removeSarPassword(id: string): Promise<{ sar: SarMetadata }> {
  return requestJson(
    `/api/sars/${encodeURIComponent(id)}/password`,
    jsonInit('DELETE'),
    'Failed to remove password',
  )
}

export function deleteSar(id: string): Promise<{ deleted: boolean }> {
  return requestJson(
    `/api/sars/${encodeURIComponent(id)}`,
    jsonInit('DELETE'),
    'Failed to delete SAR',
  )
}

export function getPublicSarMetadata(id: string): Promise<{ sar: SarMetadata }> {
  return requestJson(
    `/api/public/sars/${encodeURIComponent(id)}`,
    jsonInit('GET'),
    'Failed to load SAR',
  )
}

export function getPublicSarContent(
  id: string,
  password?: string,
): Promise<{ sar: SarWithContent }> {
  return requestJson(
    `/api/public/sars/${encodeURIComponent(id)}/content`,
    jsonInit('POST', password === undefined ? {} : { password }),
    'Failed to load SAR content',
  )
}

export function listAdminUsers(search?: string): Promise<{ users: AdminUserSummary[] }> {
  const query = search ? `?q=${encodeURIComponent(search)}` : ''
  return requestJson(`/api/admin/users${query}`, jsonInit('GET'), 'Failed to load users')
}

export function setAdminUserBan(userId: string, banned: boolean): Promise<{ user: AdminUserSummary }> {
  return requestJson(
    `/api/admin/users/${encodeURIComponent(userId)}/ban`,
    jsonInit('PATCH', { banned }),
    'Failed to update user',
  )
}

export function verifyAdminUser(userId: string): Promise<{ user: AdminUserSummary }> {
  return requestJson(
    `/api/admin/users/${encodeURIComponent(userId)}/verify`,
    jsonInit('POST'),
    'Failed to verify user',
  )
}

export function listAdminSars(input: {
  search?: string
  status?: AdminSarStatus
} = {}): Promise<{ sars: AdminSarSummary[] }> {
  const params = new URLSearchParams()
  if (input.search) {
    params.set('q', input.search)
  }
  if (input.status && input.status !== 'all') {
    params.set('status', input.status)
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return requestJson(`/api/admin/sars${suffix}`, jsonInit('GET'), 'Failed to load SARs')
}

export function getAdminSar(id: string): Promise<{ sar: AdminSarDetail }> {
  return requestJson(
    `/api/admin/sars/${encodeURIComponent(id)}`,
    jsonInit('GET'),
    'Failed to load SAR',
  )
}

export function deleteAdminSar(id: string): Promise<{ sar: AdminSarSummary }> {
  return requestJson(
    `/api/admin/sars/${encodeURIComponent(id)}`,
    jsonInit('DELETE'),
    'Failed to delete SAR',
  )
}

export function getAdminSettings(): Promise<{ settings: AdminSettingsSummary }> {
  return requestJson('/api/admin/settings/expiry', jsonInit('GET'), 'Failed to load settings')
}

export function updateAdminSettings(expiry: ExpiryInput): Promise<{ settings: AdminSettingsSummary }> {
  return requestJson(
    '/api/admin/settings/expiry',
    jsonInit('PATCH', { expiry }),
    'Failed to update settings',
  )
}
