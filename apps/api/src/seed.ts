import { prisma } from './db.js'
import { getEnv } from './config.js'
import { hashPassword } from './security.js'

async function main() {
  console.log('Seeding database...')

  // Create default app settings
  const settings = await prisma.appSettings.findMany({})
  if (settings.length === 0) {
    await prisma.appSettings.createMany({
      data: [
        { key: 'default_expiry_days', value: '7', description: 'Default SAR expiry in days' },
        { key: 'max_sar_size_bytes', value: '1048576', description: 'Maximum SAR size in bytes (1MB)' },
        { key: 'global_expiry_limit_days', value: '365', description: 'Global expiry limit in days (1 year)' },
        { key: 'admin_global_expiry_limit_days', value: '365', description: 'Admin configurable global expiry limit' },
      ],
    })
    console.log('Created default app settings')
  } else {
    console.log('App settings already exist, skipping')
  }

  // Create admin user (if not exists)
  const adminEmail = getEnv('ADMIN_EMAIL')
  const adminPassword = getEnv('ADMIN_PASSWORD')

  const existingAdmin = await prisma.user.findFirst({
    where: { email: adminEmail },
  })

  if (!existingAdmin) {
    const adminPasswordHash = hashPassword(adminPassword)

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: adminPasswordHash,
        name: 'Admin',
        emailVerified: new Date(),
        isAdmin: true,
      },
    })

    console.log(`Created admin user: ${admin.email}`)

    // Create admin audit entry
    await prisma.adminAudit.create({
      data: {
        userId: admin.id,
        action: 'admin_bootstrap',
        details: { email: adminEmail },
      },
    })
  } else if (!existingAdmin.isAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { isAdmin: true },
    })
    console.log(`Promoted existing user to admin: ${existingAdmin.email}`)
  } else {
    console.log(`Admin user already exists: ${existingAdmin.email}`)
  }

  console.log('Seed completed successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
