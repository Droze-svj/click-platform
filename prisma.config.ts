import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrate: {
    connectionUrl: process.env.DATABASE_URL,
  },
})
