import { defineConfig } from 'drizzle-kit'
import { homedir } from 'os'
import { resolve } from 'path'

const databaseUrl = process.env.DATABASE_URL ?? ''
const isPostgres =
  databaseUrl.startsWith('postgres://') ||
  databaseUrl.startsWith('postgresql://')

export default defineConfig(
  isPostgres
    ? {
        dialect: 'postgresql',
        schema: './src/server/db/schema/postgres.ts',
        out: './src/server/db/migrations',
        dbCredentials: { url: databaseUrl },
      }
    : {
        dialect: 'sqlite',
        schema: './src/server/db/schema/sqlite.ts',
        out: './src/server/db/migrations',
        dbCredentials: {
          url: process.env.SQLITE_PATH ?? resolve(homedir(), '.claude', 'web', 'claude-code.db'),
        },
      }
)
