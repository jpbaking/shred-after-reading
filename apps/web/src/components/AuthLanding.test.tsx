import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthLanding } from './AuthLanding'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('AuthLanding', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the app name, value copy, and the login form first', () => {
    render(<AuthLanding onAuthenticated={() => {}} />)

    expect(screen.getByText('shred-after-reading')).toBeDefined()
    expect(screen.getByText(/shreds itself/i)).toBeDefined()
    expect(screen.getByLabelText('Email')).toBeDefined()
    expect(screen.getByLabelText('Password')).toBeDefined()
    expect(screen.getByText(/remember me for 30 days/i)).toBeDefined()
  })

  it('registers and shows the verification-sent state', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(201, {
        user: { id: 'u1', email: 'new@example.com', name: null },
        emailSent: true,
      }),
    )

    render(<AuthLanding onAuthenticated={() => {}} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Register' }))
    await user.type(screen.getByLabelText('Email'), 'new@example.com')
    await user.type(screen.getByLabelText('Password'), 'a-long-password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByTestId('verification-sent')).toBeDefined()
    expect(screen.getByText(/check your email/i)).toBeDefined()
    expect(screen.getByText(/new@example\.com/)).toBeDefined()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('shows a visible error when registration fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(409, { error: 'An account with this email already exists' }),
    )

    render(<AuthLanding onAuthenticated={() => {}} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Register' }))
    await user.type(screen.getByLabelText('Email'), 'dup@example.com')
    await user.type(screen.getByLabelText('Password'), 'a-long-password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toBeDefined()
    expect(screen.getByText(/already exists/)).toBeDefined()
  })

  it('logs in and reports the user to the parent', async () => {
    const apiUser = {
      id: 'u1',
      email: 'who@example.com',
      name: null,
      emailVerified: true,
      isAdmin: false,
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { user: apiUser, expiresAt: new Date().toISOString() }),
    )
    const onAuthenticated = vi.fn()

    render(<AuthLanding onAuthenticated={onAuthenticated} />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('Email'), 'who@example.com')
    await user.type(screen.getByLabelText('Password'), 'a-long-password')
    const form = screen.getByRole('form', { name: 'Log in' })
    await user.click(within(form).getByRole('button', { name: 'Log in' }))

    await vi.waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(apiUser))
  })
})
