import { eq } from 'drizzle-orm'
import type { DbConnection, ActiveSchema } from '../connection.js'
import type { User, NewUser } from '../types.js'

export class UserRepository {
  constructor(
    private db: DbConnection,
    private schema: ActiveSchema
  ) {}

  async findById(id: string): Promise<User | null> {
    const results = await (this.db as any)
      .select()
      .from(this.schema.users)
      .where(eq(this.schema.users.id, id))
      .limit(1)
    return results[0] ?? null
  }

  async findByEmail(email: string): Promise<User | null> {
    const results = await (this.db as any)
      .select()
      .from(this.schema.users)
      .where(eq(this.schema.users.email, email))
      .limit(1)
    return results[0] ?? null
  }

  async findAll(): Promise<User[]> {
    return (this.db as any).select().from(this.schema.users)
  }

  async create(data: NewUser): Promise<User> {
    const results = await (this.db as any)
      .insert(this.schema.users)
      .values(data)
      .returning()
    return results[0]
  }

  async update(id: string, data: Partial<NewUser>): Promise<User | null> {
    const results = await (this.db as any)
      .update(this.schema.users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(this.schema.users.id, id))
      .returning()
    return results[0] ?? null
  }

  async delete(id: string): Promise<void> {
    await (this.db as any)
      .delete(this.schema.users)
      .where(eq(this.schema.users.id, id))
  }

  async upsertByEmail(data: NewUser): Promise<User> {
    const existing = data.email ? await this.findByEmail(data.email) : null
    if (existing) {
      return (await this.update(existing.id, data)) ?? existing
    }
    return this.create(data)
  }
}
