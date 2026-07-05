import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: new URL('../../../.env', import.meta.url) })

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('Missing required environment variable: DATABASE_URL')
}

const pool = new Pool({
  connectionString: databaseUrl,
})

const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

export { prisma }
