import { eq, lt, sql } from 'drizzle-orm'
import type { DbConnection, ActiveSchema } from '../connection.js'
import type { Session, NewSession } from '../types.js'

export class SessionRepository {
  constructor(
    private db: DbConnection,
    private schema: ActiveSchema
  ) {}

  async findById(id: string): Promise<Session | null> {
    const results = await (this.db as any)
      .select()
      .from(this.schema.sessions)
      .where(eq(this.schema.sessions.id, id))
      .limit(1)
    return results[0] ?? null
  }

  async findValidById(id: string): Promise<Session | null> {
    const session = await this.findById(id)
    if (!session) return null

    const expiresAt = session.expiresAt
    if (expiresAt && new Date(expiresAt as string) < new Date()) {
      await this.delete(id)
      return null
    }
    return session
  }

  async findByUser(userId: string): Promise<Session[]> {
    return (this.db as any)
      .select()
      .from(this.schema.sessions)
      .where(eq(this.schema.sessions.userId, userId))
  }

  async create(data: NewSession): Promise<Session> {
    const results = await (this.db as any)
      .insert(this.schema.sessions)
      .values(data)
      .returning()
    return results[0]
  }

  async upsert(data: NewSession): Promise<Session> {
    // Insert or replace on conflict
    const results = await (this.db as any)
      .insert(this.schema.sessions)
      .values(data)
      .onConflictDoUpdate({
        target: this.schema.sessions.id,
        set: { data: data.data, expiresAt: data.expiresAt },
      })
      .returning()
    return results[0]
  }

  async delete(id: string): Promise<void> {
    await (this.db as any)
      .delete(this.schema.sessions)
      .where(eq(this.schema.sessions.id, id))
  }

  async deleteByUser(userId: string): Promise<void> {
    await (this.db as any)
      .delete(this.schema.sessions)
      .where(eq(this.schema.sessions.userId, userId))
  }

  /** Remove all sessions that have passed their expiry time. */
  async deleteExpired(): Promise<number> {
    const now = new Date().toISOString()
    const results = await (this.db as any)
      .delete(this.schema.sessions)
      .where(lt(this.schema.sessions.expiresAt, now as any))
      .returning()
    return results.length
  }
}
