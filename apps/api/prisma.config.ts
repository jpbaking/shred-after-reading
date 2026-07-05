import dotenv from 'dotenv'
import { defineConfig, env } from 'prisma/config'

dotenv.config({ path: new URL('../../.env', import.meta.url) })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
