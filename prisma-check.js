import { PrismaClient } from '@prisma/client'

const p = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL || 'postgresql://x' } }
})

const run = async () => {
  try {
    await p.$connect()
    console.log('connected')
    await p.$disconnect()
  } catch (e) {
    console.error(e && e.message ? e.message : String(e))
    process.exit(1)
  }
}

run()
