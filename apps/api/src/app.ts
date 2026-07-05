import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import morgan from 'morgan'
import { config } from './config.js'
import { createAuthRouter } from './routes/auth.routes.js'
import { createAdminRouter } from './routes/admin.routes.js'
import { createSarRouter, createPublicSarRouter } from './routes/sar.routes.js'
import { AuthService, type EmailSender } from './services/auth.service.js'
import { AdminService } from './services/admin.service.js'
import { SarService } from './services/sar.service.js'
import { createAuthMiddleware, type AuthMiddleware } from './middleware/auth.middleware.js'

export interface AppDeps {
  emailService: EmailSender
  enableRequestLogging?: boolean
}

export interface AppBundle {
  app: express.Express
  authService: AuthService
  sarService: SarService
  authMiddleware: AuthMiddleware
}

export function createApp(deps: AppDeps): AppBundle {
  const app = express()

  app.use(helmet())
  if (deps.enableRequestLogging !== false) {
    app.use(morgan('combined'))
  }
  app.use(cookieParser())
  app.use(express.json({ limit: config.bodySizeLimit }))

  app.get('/healthz', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    })
  })

  const authService = new AuthService(deps.emailService)
  const adminService = new AdminService()
  const sarService = new SarService()
  const authMiddleware = createAuthMiddleware(authService)

  app.use(authMiddleware.attachUser)
  app.use('/api/auth', createAuthRouter(authService, authMiddleware))
  app.use('/api/admin', createAdminRouter(adminService, authMiddleware))
  app.use('/api/sars', createSarRouter(sarService, authMiddleware))
  app.use('/api/public/sars', createPublicSarRouter(sarService))

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('Unhandled error:', err.message)
      res.status(500).json({ error: 'Internal server error' })
    },
  )

  return { app, authService, sarService, authMiddleware }
}
