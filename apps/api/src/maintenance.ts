// Explicit maintenance command: purge SARs past the retention window.
// Usage: npm run cleanup  (or: node dist/maintenance.js)
import { prisma } from './db.js'
import { SarService, RETENTION_DAYS } from './services/sar.service.js'

async function main() {
  const sarService = new SarService()
  const purged = await sarService.purgeExpiredSars(RETENTION_DAYS)
  console.log(`Purged ${purged} SAR(s) past the ${RETENTION_DAYS}-day retention window`)
}

main()
  .catch((error) => {
    console.error('Cleanup failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
