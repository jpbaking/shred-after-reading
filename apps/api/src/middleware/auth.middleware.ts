import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { AuthService, AuthUser } from '../services/auth.service.js'

export const SESSION_COOKIE_NAME = 'session_token'

export interface AuthenticatedRequest extends Request {
  user?: AuthUser
}

export interface RequireUserOptions {
  requireVerified?: boolean
}

export interface AuthMiddleware {
  attachUser: RequestHandler
  requireUser: (options?: RequireUserOptions) => RequestHandler
  requireAdmin: RequestHandler
}

export function createAuthMiddleware(authService: AuthService): AuthMiddleware {
  const attachUser = async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const sessionToken = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined
      if (sessionToken) {
        req.user = (await authService.getUserForSession(sessionToken)) ?? undefined
      }
      next()
    } catch (error) {
      next(error)
    }
  }

  const requireUser = (options: RequireUserOptions = {}): RequestHandler => {
    const { requireVerified = true } = options

    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' })
        return
      }

      if (req.user.isBanned) {
        res.status(403).json({ error: 'This account has been banned' })
        return
      }

      if (requireVerified && !req.user.emailVerified) {
        res.status(403).json({ error: 'Please verify your email address before accessing this resource' })
        return
      }

      next()
    }
  }

  const requireAdmin: RequestHandler = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    if (req.user.isBanned) {
      res.status(403).json({ error: 'This account has been banned' })
      return
    }

    if (!req.user.isAdmin) {
      res.status(403).json({ error: 'Admin access required' })
      return
    }

    next()
  }

  return { attachUser, requireUser, requireAdmin }
}
