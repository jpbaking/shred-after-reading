import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Reset database before tests
async function resetDatabase() {
  try {
    // Try to reset the database using prisma migrate reset
    execSync('npx prisma migrate reset --force', {
      cwd: __dirname,
      stdio: 'pipe',
    })
    console.log('Database reset successfully')
  } catch (error) {
    console.error('Failed to reset database:', error)
  }
}

// Run reset before all tests
beforeAll(async () => {
  await resetDatabase()
})