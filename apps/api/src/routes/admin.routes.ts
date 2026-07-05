import { Router, type Response } from 'express'
import { AdminError, AdminService } from '../services/admin.service.js'
import type { AuthMiddleware } from '../middleware/auth.middleware.js'
import { ExpiryError } from '../expiry.js'

function handleAdminError(res: Response, error: unknown, fallbackMessage: string): Response {
  if (error instanceof AdminError) {
    return res.status(error.status).json({ error: error.message })
  }
  if (error instanceof ExpiryError) {
    return res.status(422).json({ error: error.message })
  }
  console.error(fallbackMessage, error)
  return res.status(500).json({ error: fallbackMessage })
}

export function createAdminRouter(adminService: AdminService, middleware: AuthMiddleware): Router {
  const router = Router()

  router.use(middleware.requireAdmin)

  router.get('/users', async (req, res) => {
    try {
      const search = typeof req.query.q === 'string' ? req.query.q : undefined
      const users = await adminService.listUsers(search)
      return res.status(200).json({ users })
    } catch (error) {
      return handleAdminError(res, error, 'Failed to list users')
    }
  })

  router.patch('/users/:id/ban', async (req, res) => {
    try {
      const { banned } = req.body as { banned?: unknown }
      if (typeof banned !== 'boolean') {
        return res.status(422).json({ error: 'banned must be a boolean' })
      }

      const user = await adminService.setUserBanState(String(req.params.id), banned)
      return res.status(200).json({ user })
    } catch (error) {
      return handleAdminError(res, error, 'Failed to update ban state')
    }
  })

  router.post('/users/:id/verify', async (req, res) => {
    try {
      const user = await adminService.markUserVerified(String(req.params.id))
      return res.status(200).json({ user })
    } catch (error) {
      return handleAdminError(res, error, 'Failed to verify user')
    }
  })

  router.get('/sars', async (req, res) => {
    try {
      const search = typeof req.query.q === 'string' ? req.query.q : undefined
      const status = typeof req.query.status === 'string' ? req.query.status : undefined
      const sars = await adminService.listSars({ search, status })
      return res.status(200).json({ sars })
    } catch (error) {
      return handleAdminError(res, error, 'Failed to list SARs')
    }
  })

  router.get('/sars/:id', async (req, res) => {
    try {
      const sar = await adminService.getSarDetail(String(req.params.id))
      return res.status(200).json({ sar })
    } catch (error) {
      return handleAdminError(res, error, 'Failed to load SAR')
    }
  })

  router.delete('/sars/:id', async (req, res) => {
    try {
      const sar = await adminService.deleteSar(String(req.params.id))
      return res.status(200).json({ sar })
    } catch (error) {
      return handleAdminError(res, error, 'Failed to delete SAR')
    }
  })

  router.get('/settings/expiry', async (_req, res) => {
    try {
      const settings = await adminService.getSettings()
      return res.status(200).json({ settings })
    } catch (error) {
      return handleAdminError(res, error, 'Failed to load settings')
    }
  })

  router.patch('/settings/expiry', async (req, res) => {
    try {
      const settings = await adminService.updateGlobalExpiryLimit((req.body as { expiry?: unknown }).expiry)
      return res.status(200).json({ settings })
    } catch (error) {
      return handleAdminError(res, error, 'Failed to update settings')
    }
  })

  return router
}
