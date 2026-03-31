import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3'
import postgres from 'postgres'
import Database from 'better-sqlite3'
import { homedir } from 'os'
import { mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { pgSchema, type PgSchema } from './schema/postgres.js'
import { sqliteSchema, type SqliteSchema } from './schema/sqlite.js'

export type DbType = 'postgres' | 'sqlite'

export type ActiveSchema = PgSchema | SqliteSchema

export type DbConnection =
  | ReturnType<typeof drizzlePg<PgSchema>>
  | ReturnType<typeof drizzleSqlite<SqliteSchema>>

let _db: DbConnection | null = null
let _schema: ActiveSchema | null = null
let _dbType: DbType | null = null

function getDefaultSqlitePath(): string {
  return resolve(homedir(), '.claude', 'web', 'claude-code.db')
}

function createSqliteConnection(): {
  db: ReturnType<typeof drizzleSqlite<SqliteSchema>>
  schema: SqliteSchema
} {
  const dbPath = process.env.SQLITE_PATH ?? getDefaultSqlitePath()
  mkdirSync(dirname(dbPath), { recursive: true })

  const sqlite = new Database(dbPath)

  // Enable WAL mode for concurrent reads and better write performance
  sqlite.pragma('journal_mode = WAL')
  // Enable auto-vacuum to reclaim space
  sqlite.pragma('auto_vacuum = INCREMENTAL')
  // Enforce foreign key constraints
  sqlite.pragma('foreign_keys = ON')

  const db = drizzleSqlite(sqlite, { schema: sqliteSchema })
  return { db, schema: sqliteSchema }
}

function createPostgresConnection(): {
  db: ReturnType<typeof drizzlePg<PgSchema>>
  schema: PgSchema
} {
  const connectionString = process.env.DATABASE_URL!
  const isProduction = process.env.NODE_ENV === 'production'

  const client = postgres(connectionString, {
    max: 20,
    ssl: isProduction ? 'require' : false,
    idle_timeout: 30,
    connect_timeout: 10,
  })

  const db = drizzlePg(client, { schema: pgSchema })
  return { db, schema: pgSchema }
}

export function getDbType(): DbType {
  const url = process.env.DATABASE_URL ?? ''
  return url.startsWith('postgres://') || url.startsWith('postgresql://')
    ? 'postgres'
    : 'sqlite'
}

export function connect(): { db: DbConnection; schema: ActiveSchema; dbType: DbType } {
  if (_db && _schema && _dbType) {
    return { db: _db, schema: _schema, dbType: _dbType }
  }

  _dbType = getDbType()

  if (_dbType === 'postgres') {
    const { db, schema } = createPostgresConnection()
    _db = db
    _schema = schema
  } else {
    const { db, schema } = createSqliteConnection()
    _db = db
    _schema = schema
  }

  return { db: _db, schema: _schema, dbType: _dbType }
}

// Re-export for convenience — callers can call connect() once at startup
// and then import { db, schema } from this module after initialisation.
export function getDb(): DbConnection {
  if (!_db) throw new Error('Database not connected. Call connect() first.')
  return _db
}

export function getSchema(): ActiveSchema {
  if (!_schema) throw new Error('Database not connected. Call connect() first.')
  return _schema
}
