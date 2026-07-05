import { Router, type Response } from 'express'
import { SarService, SarError } from '../services/sar.service.js'
import { parseExpiryRequest } from '../services/expiry.service.js'
import { ExpiryError, type ExpiryRequest } from '../expiry.js'
import type { AuthenticatedRequest, AuthMiddleware } from '../middleware/auth.middleware.js'

function handleSarError(res: Response, error: unknown, fallbackMessage: string): Response {
  if (error instanceof SarError) {
    return res.status(error.status).json({ error: error.message })
  }
  if (error instanceof ExpiryError) {
    return res.status(422).json({ error: error.message })
  }
  console.error(fallbackMessage, error)
  return res.status(500).json({ error: fallbackMessage })
}

function parseOptionalExpiry(input: unknown): ExpiryRequest | undefined {
  if (input === undefined || input === null) {
    return undefined
  }
  return parseExpiryRequest(input)
}

export function createSarRouter(sarService: SarService, middleware: AuthMiddleware): Router {
  const router = Router()

  router.post('/', middleware.requireUser(), async (req: AuthenticatedRequest, res) => {
    try {
      const { content, isMarkdown, password, expiry } = req.body as {
        content?: unknown
        isMarkdown?: unknown
        password?: unknown
        expiry?: unknown
      }

      if (typeof content !== 'string') {
        return res.status(422).json({ error: 'Content is required' })
      }
      if (password !== undefined && typeof password !== 'string') {
        return res.status(422).json({ error: 'Password must be a string' })
      }

      const sar = await sarService.createSarForOwner({
        userId: req.user!.id,
        content,
        isMarkdown: isMarkdown === true,
        password: password as string | undefined,
        expiry: parseOptionalExpiry(expiry),
      })

      return res.status(201).json({ sar })
    } catch (error) {
      return handleSarError(res, error, 'Failed to create SAR')
    }
  })

  router.get('/', middleware.requireUser(), async (req: AuthenticatedRequest, res) => {
    try {
      const sars = await sarService.listActiveForOwner(req.user!.id)
      return res.status(200).json({ sars })
    } catch (error) {
      return handleSarError(res, error, 'Failed to list SARs')
    }
  })

  router.get('/:id', middleware.requireUser(), async (req: AuthenticatedRequest, res) => {
    try {
      const sar = await sarService.readOwnedContent(req.user!.id, String(req.params.id))
      return res.status(200).json({ sar })
    } catch (error) {
      return handleSarError(res, error, 'Failed to read SAR')
    }
  })

  router.patch('/:id/expiry', middleware.requireUser(), async (req: AuthenticatedRequest, res) => {
    try {
      const expiry = parseExpiryRequest((req.body as { expiry?: unknown }).expiry)
      const sar = await sarService.changeExpiryForOwner(req.user!.id, String(req.params.id), expiry)
      return res.status(200).json({ sar })
    } catch (error) {
      return handleSarError(res, error, 'Failed to change expiry')
    }
  })

  router.put('/:id/password', middleware.requireUser(), async (req: AuthenticatedRequest, res) => {
    try {
      const { password } = req.body as { password?: unknown }
      if (typeof password !== 'string' || password.length === 0) {
        return res.status(422).json({ error: 'Password is required' })
      }
      const sar = await sarService.setPasswordForOwner(req.user!.id, String(req.params.id), password)
      return res.status(200).json({ sar })
    } catch (error) {
      return handleSarError(res, error, 'Failed to set password')
    }
  })

  router.delete(
    '/:id/password',
    middleware.requireUser(),
    async (req: AuthenticatedRequest, res) => {
      try {
        const sar = await sarService.removePasswordForOwner(req.user!.id, String(req.params.id))
        return res.status(200).json({ sar })
      } catch (error) {
        return handleSarError(res, error, 'Failed to remove password')
      }
    },
  )

  router.delete('/:id', middleware.requireUser(), async (req: AuthenticatedRequest, res) => {
    try {
      await sarService.deleteForOwner(req.user!.id, String(req.params.id))
      return res.status(200).json({ deleted: true })
    } catch (error) {
      return handleSarError(res, error, 'Failed to delete SAR')
    }
  })

  return router
}

export function createPublicSarRouter(sarService: SarService): Router {
  const router = Router()

  router.get('/:id', async (req, res) => {
    try {
      const sar = await sarService.readPublicMetadata(req.params.id)
      return res.status(200).json({ sar })
    } catch (error) {
      return handleSarError(res, error, 'Failed to read SAR')
    }
  })

  // POST so the password travels in the body, never in the URL.
  router.post('/:id/content', async (req, res) => {
    try {
      const { password } = (req.body ?? {}) as { password?: unknown }
      if (password !== undefined && typeof password !== 'string') {
        return res.status(422).json({ error: 'Password must be a string' })
      }
      const sar = await sarService.readPublicContent(req.params.id, password as string | undefined)
      return res.status(200).json({ sar })
    } catch (error) {
      return handleSarError(res, error, 'Failed to read SAR content')
    }
  })

  return router
}
