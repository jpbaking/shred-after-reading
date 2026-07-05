import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminPage } from './AdminPage'

interface FakeAdminUser {
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

interface FakeAdminSar {
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
  status: 'active' | 'expired' | 'deleted'
  contentPreview: string
  content: string
}

class FakeAdminBackend {
  users: FakeAdminUser[] = [
    {
      id: 'user-1',
      email: 'user.one@example.com',
      name: 'User One',
      emailVerified: false,
      isAdmin: false,
      isBanned: false,
      createdAt: new Date('2026-07-01T00:00:00.000Z').toISOString(),
      sarStats: { total: 2, active: 1, expired: 1, deleted: 0 },
    },
    {
      id: 'user-2',
      email: 'user.two@example.com',
      name: 'User Two',
      emailVerified: true,
      isAdmin: false,
      isBanned: true,
      createdAt: new Date('2026-07-02T00:00:00.000Z').toISOString(),
      sarStats: { total: 1, active: 0, expired: 0, deleted: 1 },
    },
  ]

  sars: FakeAdminSar[] = [
    {
      id: '01890000-0000-7000-8000-000000000001',
      owner: { id: 'user-1', email: 'user.one@example.com', name: 'User One' },
      sharePath: '/sar/01890000-0000-7000-8000-000000000001',
      passwordRequired: true,
      isMarkdown: true,
      createdAt: new Date('2026-07-03T00:00:00.000Z').toISOString(),
      expiresAt: new Date('2026-07-06T00:00:00.000Z').toISOString(),
      deletedAt: null,
      status: 'active',
      contentPreview: 'alpha visible content',
      content: '# alpha visible content',
    },
    {
      id: '01890000-0000-7000-8000-000000000002',
      owner: { id: 'user-2', email: 'user.two@example.com', name: 'User Two' },
      sharePath: '/sar/01890000-0000-7000-8000-000000000002',
      passwordRequired: false,
      isMarkdown: false,
      createdAt: new Date('2026-07-03T00:00:00.000Z').toISOString(),
      expiresAt: new Date('2026-07-01T00:00:00.000Z').toISOString(),
      deletedAt: null,
      status: 'expired',
      contentPreview: 'beta expired content',
      content: 'beta expired content',
    },
  ]

  settings = {
    globalExpiryLimit: { amount: 7, unit: 'days' as const },
    hardCap: { amount: 1, unit: 'year' as const },
  }

  private json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const path = url.replace(/^https?:\/\/[^/]+/, '')
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}

    if (path.startsWith('/api/admin/users') && method === 'GET') {
      const query = new URL(`http://local${path}`).searchParams.get('q')?.toLowerCase() ?? ''
      const users = this.users.filter((user) =>
        query.length === 0
          ? true
          : user.email.toLowerCase().includes(query) || (user.name ?? '').toLowerCase().includes(query),
      )
      return this.json(200, { users })
    }

    const banMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/ban$/)
    if (banMatch && method === 'PATCH') {
      const user = this.users.find((entry) => entry.id === banMatch[1])
      if (!user) return this.json(404, { error: 'User not found' })
      user.isBanned = body.banned === true
      return this.json(200, { user })
    }

    const verifyMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/verify$/)
    if (verifyMatch && method === 'POST') {
      const user = this.users.find((entry) => entry.id === verifyMatch[1])
      if (!user) return this.json(404, { error: 'User not found' })
      user.emailVerified = true
      return this.json(200, { user })
    }

    if (path.startsWith('/api/admin/sars') && method === 'GET' && !path.match(/^\/api\/admin\/sars\/[^/]+$/)) {
      const params = new URL(`http://local${path}`).searchParams
      const query = params.get('q')?.toLowerCase() ?? ''
      const status = params.get('status') ?? 'all'
      const sars = this.sars.filter((sar) => {
        const statusMatches = status === 'all' ? true : sar.status === status
        const searchMatches =
          query.length === 0
            ? true
            : sar.contentPreview.toLowerCase().includes(query) ||
              sar.owner.email.toLowerCase().includes(query) ||
              sar.id.toLowerCase().includes(query)
        return statusMatches && searchMatches
      })
      return this.json(200, { sars: sars.map(({ content, ...sar }) => sar) })
    }

    const sarMatch = path.match(/^\/api\/admin\/sars\/([^/]+)$/)
    if (sarMatch && method === 'GET') {
      const sar = this.sars.find((entry) => entry.id === sarMatch[1])
      if (!sar) return this.json(404, { error: 'SAR not found' })
      return this.json(200, { sar })
    }
    if (sarMatch && method === 'DELETE') {
      const sar = this.sars.find((entry) => entry.id === sarMatch[1])
      if (!sar) return this.json(404, { error: 'SAR not found' })
      sar.status = 'deleted'
      sar.deletedAt = new Date().toISOString()
      return this.json(200, {
        sar: {
          id: sar.id,
          owner: sar.owner,
          sharePath: sar.sharePath,
          passwordRequired: sar.passwordRequired,
          isMarkdown: sar.isMarkdown,
          createdAt: sar.createdAt,
          expiresAt: sar.expiresAt,
          deletedAt: sar.deletedAt,
          status: sar.status,
          contentPreview: sar.contentPreview,
        },
      })
    }

    if (path === '/api/admin/settings/expiry' && method === 'GET') {
      return this.json(200, { settings: this.settings })
    }
    if (path === '/api/admin/settings/expiry' && method === 'PATCH') {
      this.settings.globalExpiryLimit = body.expiry as typeof this.settings.globalExpiryLimit
      return this.json(200, { settings: this.settings })
    }
    if (path === '/api/auth/logout' && method === 'POST') {
      return this.json(200, { message: 'ok' })
    }

    return this.json(404, { error: `Unhandled: ${method} ${path}` })
  }
}

let backend: FakeAdminBackend
beforeEach(() => {
  backend = new FakeAdminBackend()
  vi.spyOn(globalThis, 'fetch').mockImplementation(backend.fetch)
})

describe('AdminPage smoke', () => {
  it('views user stats, bans/unbans and verifies users, filters SARs, views content, deletes a SAR, and changes global expiry', async () => {
    const user = userEvent.setup()

    render(
      <AdminPage
        user={{
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Admin',
          emailVerified: true,
          isAdmin: true,
        }}
        onLoggedOut={vi.fn()}
      />,
    )

    const overview = await screen.findByRole('region', { name: 'Admin overview' })
    expect(within(overview).getByText('Users')).toBeDefined()
    expect(within(overview).getByText('SARs tracked')).toBeDefined()

    const usersSection = screen.getByRole('region', { name: 'Users' })
    await within(usersSection).findByText('user.one@example.com')
    let userOneRow = within(usersSection).getByText('user.one@example.com').closest('tr')
    expect(userOneRow).not.toBeNull()

    await user.click(within(userOneRow!).getByRole('button', { name: 'Verify' }))
    await waitFor(() => {
      expect(backend.users[0].emailVerified).toBe(true)
    })

    userOneRow = within(usersSection).getByText('user.one@example.com').closest('tr')
    expect(userOneRow).not.toBeNull()
    const banButton = within(userOneRow!).getByRole('button', { name: 'Ban' })
    await user.click(banButton)
    await waitFor(() => {
      expect(backend.users[0].isBanned).toBe(true)
    })
    userOneRow = within(usersSection).getByText('user.one@example.com').closest('tr')
    expect(userOneRow).not.toBeNull()
    expect(within(userOneRow!).getByRole('button', { name: 'Unban' })).toBeDefined()

    const sarsSection = screen.getByRole('region', { name: 'SARs' })
    await user.selectOptions(within(sarsSection).getByLabelText('SAR status filter'), 'expired')
    await user.click(within(sarsSection).getByRole('button', { name: 'Filter' }))
    await within(sarsSection).findByText('beta expired content')

    await user.clear(within(sarsSection).getByLabelText('Search SARs'))
    await user.type(within(sarsSection).getByLabelText('Search SARs'), 'alpha')
    await user.selectOptions(within(sarsSection).getByLabelText('SAR status filter'), 'active')
    await user.click(within(sarsSection).getByRole('button', { name: 'Filter' }))
    await within(sarsSection).findByText('alpha visible content')
    expect(within(sarsSection).getByText('password')).toBeDefined()

    const sarRow = within(sarsSection).getByText('alpha visible content').closest('tr')
    expect(sarRow).not.toBeNull()
    const copyButton = within(sarRow!).getByRole('button', { name: 'Copy' })
    await user.click(copyButton)
    expect(within(sarRow!).getByRole('button', { name: 'Copied' })).toBeDefined()
    await waitFor(
      () => {
        expect(within(sarRow!).getByRole('button', { name: 'Copy' })).toBeDefined()
      },
      { timeout: 3000 },
    )

    await user.click(within(sarRow!).getByRole('button', { name: 'alpha visible content' }))
    const detail = await screen.findByTestId('admin-sar-detail')
    expect(within(detail).getByText('alpha visible content')).toBeDefined()
    await user.click(within(detail).getByRole('button', { name: 'Close' }))

    await user.click(within(sarRow!).getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(backend.sars[0].status).toBe('deleted')
    })

    const settingsSection = screen.getByRole('region', { name: 'Global expiry setting' })
    await user.clear(within(settingsSection).getByLabelText('Global expiry amount'))
    await user.type(within(settingsSection).getByLabelText('Global expiry amount'), '1')
    await user.selectOptions(within(settingsSection).getByLabelText('Global expiry unit'), 'days')
    await user.click(within(settingsSection).getByRole('button', { name: 'Save limit' }))
    await waitFor(() => {
      expect(backend.settings.globalExpiryLimit).toEqual({ amount: 1, unit: 'days' })
    })
    expect(within(settingsSection).getByText(/Current limit: 1 days/)).toBeDefined()
  })
})
