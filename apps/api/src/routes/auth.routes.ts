import { Router, type Response } from 'express'
import type { CookieOptions } from 'express'
import { AuthService, AuthError } from '../services/auth.service.js'
import { config } from '../config.js'
import {
  SESSION_COOKIE_NAME,
  type AuthenticatedRequest,
  type AuthMiddleware,
} from '../middleware/auth.middleware.js'

function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
  }
}

function handleAuthError(res: Response, error: unknown, fallbackMessage: string): Response {
  if (error instanceof AuthError) {
    return res.status(error.status).json({ error: error.message })
  }
  console.error(fallbackMessage, error)
  return res.status(500).json({ error: fallbackMessage })
}

export function createAuthRouter(authService: AuthService, middleware: AuthMiddleware): Router {
  const router = Router()

  router.post('/register', async (req, res) => {
    try {
      const { email, password, name } = req.body as {
        email?: string
        password?: string
        name?: string
      }

      if (!email || !password) {
        return res.status(422).json({ error: 'Email and password are required' })
      }

      const result = await authService.register({ email, password, name })

      return res.status(201).json({
        user: result.user,
        emailSent: result.emailSent,
      })
    } catch (error) {
      return handleAuthError(res, error, 'Registration failed')
    }
  })

  router.get('/verify-email', async (req, res) => {
    try {
      const token = req.query.token

      if (typeof token !== 'string' || token.length === 0) {
        return res.status(422).json({ error: 'Token is required' })
      }

      const result = await authService.verifyEmail(token)

      return res.status(200).json({ verified: true, email: result.email })
    } catch (error) {
      return handleAuthError(res, error, 'Verification failed')
    }
  })

  router.post('/login', async (req, res) => {
    try {
      const { email, password, rememberMe } = req.body as {
        email?: string
        password?: string
        rememberMe?: boolean
      }

      if (!email || !password) {
        return res.status(422).json({ error: 'Email and password are required' })
      }

      const result = await authService.login({
        email,
        password,
        rememberMe: rememberMe === true,
      })

      res.cookie(SESSION_COOKIE_NAME, result.sessionToken, {
        ...sessionCookieOptions(),
        maxAge: result.expiresAt.getTime() - Date.now(),
      })

      return res.status(200).json({
        user: result.user,
        expiresAt: result.expiresAt,
      })
    } catch (error) {
      return handleAuthError(res, error, 'Login failed')
    }
  })

  router.post('/logout', async (req: AuthenticatedRequest, res) => {
    try {
      const sessionToken = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined

      if (sessionToken) {
        await authService.logout(sessionToken)
      }

      res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions())

      return res.status(200).json({ message: 'Logged out successfully' })
    } catch (error) {
      return handleAuthError(res, error, 'Logout failed')
    }
  })

  router.get(
    '/me',
    middleware.requireUser({ requireVerified: false }),
    (req: AuthenticatedRequest, res) => {
      return res.status(200).json({ user: req.user })
    },
  )

  return router
}
