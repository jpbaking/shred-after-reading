import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

interface FakeSar {
  id: string
  content: string
  isMarkdown: boolean
  password?: string
  isShredded: boolean
  expiresAt: Date
  createdAt: Date
}

class FakeBackend {
  loggedIn = false
  sars = new Map<string, FakeSar>()
  private counter = 0

  user = {
    id: 'u1',
    email: 'smoke@example.com',
    name: null,
    emailVerified: true,
    isAdmin: false,
  }

  newId(): string {
    this.counter += 1
    const suffix = this.counter.toString(16).padStart(12, '0')
    return `01890000-0000-7000-8000-${suffix}`
  }

  private json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  private metadataOf(sar: FakeSar) {
    return {
      id: sar.id,
      passwordRequired: sar.password !== undefined,
      isMarkdown: sar.isMarkdown,
      createdAt: sar.createdAt.toISOString(),
      expiresAt: sar.expiresAt.toISOString(),
    }
  }

  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const path = url.replace(/^https?:\/\/[^/]+/, '')
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}

    if (path === '/api/auth/me') {
      return this.loggedIn ? this.json(200, { user: this.user }) : this.json(401, { error: 'Not authenticated' })
    }
    if (path === '/api/auth/login' && method === 'POST') {
      this.loggedIn = true
      return this.json(200, { user: this.user, expiresAt: new Date(Date.now() + 86_400_000).toISOString() })
    }
    if (path === '/api/auth/logout' && method === 'POST') {
      this.loggedIn = false
      return this.json(200, { message: 'ok' })
    }

    if (path === '/api/sars' && method === 'POST') {
      const sar: FakeSar = {
        id: this.newId(),
        content: String(body.content ?? ''),
        isMarkdown: body.isMarkdown === true,
        password: typeof body.password === 'string' ? body.password : undefined,
        isShredded: false,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
        createdAt: new Date(),
      }
      this.sars.set(sar.id, sar)
      return this.json(201, { sar: this.metadataOf(sar) })
    }
    if (path === '/api/sars' && method === 'GET') {
      const active = [...this.sars.values()].filter(
        (s) => !s.isShredded && s.expiresAt > new Date(),
      )
      return this.json(200, {
        sars: active.map((s) => ({ ...this.metadataOf(s), contentPreview: s.content.slice(0, 160) })),
      })
    }

    const ownerMatch = path.match(/^\/api\/sars\/([^/]+)(\/(expiry|password))?$/)
    if (ownerMatch) {
      const sar = this.sars.get(ownerMatch[1])
      if (!sar) return this.json(404, { error: 'SAR not found' })
      if (!ownerMatch[2] && method === 'GET') {
        return this.json(200, { sar: { ...this.metadataOf(sar), content: sar.content } })
      }
      if (ownerMatch[3] === 'expiry' && method === 'PATCH') {
        const expiry = body.expiry as { amount: number; unit: string }
        const minutes =
          expiry.unit === 'minutes' ? expiry.amount
          : expiry.unit === 'hours' ? expiry.amount * 60
          : expiry.unit === 'days' ? expiry.amount * 1440
          : expiry.unit === 'months' ? expiry.amount * 43_200
          : expiry.amount * 525_600
        sar.expiresAt = new Date(Date.now() + minutes * 60_000)
        return this.json(200, { sar: this.metadataOf(sar) })
      }
      if (ownerMatch[3] === 'password' && method === 'PUT') {
        sar.password = String(body.password)
        return this.json(200, { sar: this.metadataOf(sar) })
      }
      if (ownerMatch[3] === 'password' && method === 'DELETE') {
        sar.password = undefined
        return this.json(200, { sar: this.metadataOf(sar) })
      }
      if (!ownerMatch[2] && method === 'DELETE') {
        sar.isShredded = true
        return this.json(200, { deleted: true })
      }
    }

    const publicMatch = path.match(/^\/api\/public\/sars\/([^/]+)(\/content)?$/)
    if (publicMatch) {
      const id = decodeURIComponent(publicMatch[1])
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return this.json(422, { error: 'Malformed SAR id' })
      }
      const sar = this.sars.get(id)
      if (!sar) return this.json(404, { error: 'SAR not found' })
      if (sar.isShredded || sar.expiresAt <= new Date()) {
        return this.json(410, { error: 'This SAR is no longer available' })
      }
      if (!publicMatch[2]) {
        return this.json(200, { sar: this.metadataOf(sar) })
      }
      if (sar.password !== undefined) {
        if (typeof body.password !== 'string' || body.password === '') {
          return this.json(401, { error: 'Password required' })
        }
        if (body.password !== sar.password) {
          return this.json(403, { error: 'Incorrect password' })
        }
      }
      return this.json(200, { sar: { ...this.metadataOf(sar), content: sar.content } })
    }

    return this.json(404, { error: `Unhandled: ${method} ${path}` })
  }
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

async function loginToApp(user: ReturnType<typeof userEvent.setup>) {
  const result = renderAt('/')
  const form = await screen.findByRole('form', { name: 'Log in' })
  await user.type(within(form).getByLabelText('Email'), 'smoke@example.com')
  await user.type(within(form).getByLabelText('Password'), 'a-long-password')
  await user.click(within(form).getByRole('button', { name: 'Log in' }))
  await screen.findByRole('form', { name: 'Create a SAR' })
  return result
}

let backend: FakeBackend

beforeEach(() => {
  backend = new FakeBackend()
  vi.spyOn(globalThis, 'fetch').mockImplementation(backend.fetch)
})

describe('App smoke: create and manage SARs', () => {
  it('shows the admin link only for admin users', async () => {
    const regularUser = userEvent.setup()
    const regularRender = await loginToApp(regularUser)
    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull()
    regularRender.unmount()

    backend = new FakeBackend()
    backend.user.isAdmin = true
    vi.spyOn(globalThis, 'fetch').mockImplementation(backend.fetch)

    const adminUser = userEvent.setup()
    await loginToApp(adminUser)
    const adminLink = screen.getByRole('link', { name: 'Admin' })
    expect(adminLink.getAttribute('href')).toBe('/administration')
  })

  it('gates the administration route by login and admin status', async () => {
    const { unmount: unmountLogin } = renderAt('/administration')
    expect(await screen.findByRole('region', { name: 'Admin log in' })).toBeDefined()
    unmountLogin()

    backend.loggedIn = true
    const { unmount: unmountForbidden } = renderAt('/administration')
    expect((await screen.findAllByText('Admin access required')).length).toBeGreaterThan(0)
    unmountForbidden()

    backend = new FakeBackend()
    backend.loggedIn = true
    backend.user.isAdmin = true
    vi.spyOn(globalThis, 'fetch').mockImplementation(backend.fetch)

    renderAt('/administration')
    expect(await screen.findByRole('heading', { name: 'Keep users, shared notes, and expiry policy in view.' })).toBeDefined()
  })

  it('logs in, opens /app, and gets share URLs for a plain and a password-protected SAR', async () => {
    const user = userEvent.setup()
    await loginToApp(user)
    const createSection = screen.getByRole('region', { name: 'Create a note' })

    await user.type(screen.getByLabelText('Note'), 'first plain note')
    await user.click(within(createSection).getByRole('button', { name: 'Share' }))

    const firstResult = await screen.findByTestId('share-result')
    const firstUrl = within(firstResult).getByRole('link').getAttribute('href')
    expect(firstUrl).toMatch(/\/sar\/[0-9a-f-]{36}$/)
    const firstItem = await screen.findByText('first plain note')
    const firstRow = firstItem.closest('[data-testid^="sar-item-"]')
    expect(firstRow).not.toBeNull()
    await user.click(within(firstRow as HTMLElement).getByRole('button', { name: 'Share' }))
    expect(await screen.findByRole('heading', { name: 'Share link copied' })).toBeDefined()
    await user.click(screen.getByRole('button', { name: 'Close' }))

    await user.click(within(firstRow as HTMLElement).getByRole('button', { name: 'first plain note' }))
    const ownedDetail = await screen.findByTestId('owned-sar-detail')
    expect(within(ownedDetail).getByText('first plain note')).toBeDefined()
    await user.click(within(ownedDetail).getByRole('button', { name: 'Close' }))

    await user.type(screen.getByLabelText('Note'), 'secret note')
    await user.click(screen.getByText('Password protect'))
    await user.type(screen.getByLabelText('Password'), 'hunter22')
    await user.click(within(createSection).getByRole('button', { name: 'Share' }))

    await waitFor(() => {
      const result = screen.getByTestId('share-result')
      const url = within(result).getByRole('link').getAttribute('href')
      expect(url).not.toBe(firstUrl)
    })

    const protectedSar = [...backend.sars.values()].find((s) => s.password === 'hunter22')
    expect(protectedSar).toBeDefined()
  })

  it('updates the Markdown preview while typing and keeps XSS harmless', async () => {
    const user = userEvent.setup()
    await loginToApp(user)

    await user.click(screen.getByText('Markdown'))
    const editor = screen.getByLabelText('Note')

    await user.type(editor, '**bold** <script>alert(1)</script>')

    await user.click(screen.getByRole('tab', { name: 'Preview' }))
    const preview = screen.getByTestId('markdown-preview')
    await waitFor(() => {
      expect(within(preview).getByText('bold').tagName).toBe('STRONG')
    })
    expect(preview.querySelector('script')).toBeNull()
    expect(screen.queryByLabelText('Note')).toBeNull()

    await user.click(screen.getByRole('tab', { name: 'Raw' }))
    expect(screen.getByLabelText('Note')).not.toBeNull()
  })

  it('manages the list: change expiry, set password, delete, and refresh', async () => {
    const user = userEvent.setup()
    await loginToApp(user)
    const createSection = screen.getByRole('region', { name: 'Create a note' })

    for (const text of ['note one', 'note two']) {
      await user.clear(screen.getByLabelText('Note'))
      await user.type(screen.getByLabelText('Note'), text)
      await user.click(within(createSection).getByRole('button', { name: 'Share' }))
      await screen.findByText(text)
    }

    const [idOne, idTwo] = [...backend.sars.keys()]

    // Change expiry on the first note.
    const itemOne = screen.getByTestId(`sar-item-${idOne}`)
    await user.click(within(itemOne).getByRole('button', { name: 'Expiry' }))
    const expiryEditor = await screen.findByTestId('expiry-editor')
    await user.clear(within(expiryEditor).getByLabelText('New expiry amount'))
    await user.type(within(expiryEditor).getByLabelText('New expiry amount'), '2')
    await user.selectOptions(within(expiryEditor).getByLabelText('New expiry unit'), 'hours')
    await user.click(within(expiryEditor).getByRole('button', { name: 'Save expiry' }))

    await waitFor(() => {
      const hours = (backend.sars.get(idOne)!.expiresAt.getTime() - Date.now()) / 3_600_000
      expect(hours).toBeGreaterThan(1.9)
      expect(hours).toBeLessThan(2.1)
    })

    // Password-protect the second note.
    const itemTwo = screen.getByTestId(`sar-item-${idTwo}`)
    await user.click(within(itemTwo).getByRole('button', { name: 'Password' }))
    const passwordEditor = await screen.findByTestId('password-editor')
    await user.type(within(passwordEditor).getByLabelText('New SAR password'), 'list-pass')
    await user.click(within(passwordEditor).getByRole('button', { name: 'Save password' }))

    await waitFor(() => {
      expect(backend.sars.get(idTwo)!.password).toBe('list-pass')
    })
    await waitFor(() => {
      expect(
        within(screen.getByTestId(`sar-item-${idTwo}`)).getByText('password'),
      ).toBeDefined()
    })

    // Delete the first note; it must leave the list.
    await user.click(
      within(screen.getByTestId(`sar-item-${idOne}`)).getByRole('button', { name: 'Delete' }),
    )
    await waitFor(() => {
      expect(screen.queryByTestId(`sar-item-${idOne}`)).toBeNull()
    })
    expect(screen.getByTestId(`sar-item-${idTwo}`)).toBeDefined()
    expect(backend.sars.get(idOne)!.isShredded).toBe(true)
  })
})

describe('App smoke: public share page', () => {
  function seedSar(overrides: Partial<FakeSar> = {}): FakeSar {
    const sar: FakeSar = {
      id: backend.newId(),
      content: 'shared content',
      isMarkdown: false,
      isShredded: false,
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: new Date(),
      ...overrides,
    }
    backend.sars.set(sar.id, sar)
    return sar
  }

  it('shows an active plain-text SAR with the disclaimer', async () => {
    const sar = seedSar()
    renderAt(`/sar/${sar.id}`)

    const view = await screen.findByTestId('sar-view')
    expect(within(view).getByTestId('sar-plain').textContent).toBe('shared content')
    expect(screen.getAllByText(/do(es)? not endorse/i).length).toBeGreaterThan(0)
  })

  it('renders Markdown SARs through the safe path', async () => {
    const sar = seedSar({ content: '# Title\n\n<script>alert(1)</script>', isMarkdown: true })
    const { container } = renderAt(`/sar/${sar.id}`)

    await screen.findByTestId('sar-view')
    expect(screen.getByRole('heading', { name: 'Title' })).toBeDefined()
    expect(container.querySelector('script')).toBeNull()
  })

  it('handles the password flow: prompt, wrong password, correct password', async () => {
    const sar = seedSar({ content: 'locked content', password: 'sesame' })
    renderAt(`/sar/${sar.id}`)
    const user = userEvent.setup()

    const prompt = await screen.findByTestId('password-prompt')
    await user.type(within(prompt).getByLabelText(/password protected/i), 'wrong')
    await user.click(within(prompt).getByRole('button', { name: 'Unlock' }))
    expect(await screen.findByText('Incorrect password.')).toBeDefined()

    await user.clear(within(prompt).getByLabelText(/password protected/i))
    await user.type(within(prompt).getByLabelText(/password protected/i), 'sesame')
    await user.click(within(prompt).getByRole('button', { name: 'Unlock' }))

    const view = await screen.findByTestId('sar-view')
    expect(within(view).getByTestId('sar-plain').textContent).toBe('locked content')
  })

  it('shows gone states for expired, deleted, unknown, and malformed links', async () => {
    const expired = seedSar({ expiresAt: new Date(Date.now() - 1000) })
    const { unmount: u1 } = renderAt(`/sar/${expired.id}`)
    expect((await screen.findByTestId('sar-gone')).textContent).toContain('expired')
    u1()

    const deleted = seedSar({ isShredded: true })
    const { unmount: u2 } = renderAt(`/sar/${deleted.id}`)
    expect((await screen.findByTestId('sar-gone')).textContent).toContain('expired')
    u2()

    const { unmount: u3 } = renderAt('/sar/01890000-0000-7000-8000-ffffffffffff')
    expect((await screen.findByTestId('sar-gone')).textContent).toContain('no note')
    u3()

    renderAt('/sar/not-a-valid-id')
    expect((await screen.findByTestId('sar-gone')).textContent).toContain('no note')
  })
})
