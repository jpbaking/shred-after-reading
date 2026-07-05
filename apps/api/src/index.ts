import { config } from './config.js'
import { createApp } from './app.js'
import { EmailService } from './services/email.service.js'
import { RETENTION_DAYS } from './services/sar.service.js'

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // hourly

const emailService = new EmailService({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: false,
})

const { app, sarService } = createApp({ emailService })

async function runCleanup(): Promise<void> {
  try {
    const purged = await sarService.purgeExpiredSars(RETENTION_DAYS)
    if (purged > 0) {
      console.log(`Cleanup purged ${purged} SAR(s) past the ${RETENTION_DAYS}-day retention window`)
    }
  } catch (error) {
    console.error('SAR cleanup failed:', error)
  }
}

app.listen(config.port, () => {
  console.log(`API server listening on port ${config.port}`)
  console.log(`Body size limit: ${config.bodySizeLimit} bytes`)
  void runCleanup()
  setInterval(() => void runCleanup(), CLEANUP_INTERVAL_MS).unref()
})
