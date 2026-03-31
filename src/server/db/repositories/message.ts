import { asc, desc, eq } from 'drizzle-orm'
import type { DbConnection, ActiveSchema } from '../connection.js'
import type { Message, NewMessage, PaginationOptions } from '../types.js'

export class MessageRepository {
  constructor(
    private db: DbConnection,
    private schema: ActiveSchema
  ) {}

  async findByConversation(
    conversationId: string,
    options: PaginationOptions = {}
  ): Promise<Message[]> {
    const { limit = 100, offset = 0 } = options
    return (this.db as any)
      .select()
      .from(this.schema.messages)
      .where(eq(this.schema.messages.conversationId, conversationId))
      .orderBy(asc(this.schema.messages.createdAt))
      .limit(limit)
      .offset(offset)
  }

  async findById(id: string): Promise<Message | null> {
    const results = await (this.db as any)
      .select()
      .from(this.schema.messages)
      .where(eq(this.schema.messages.id, id))
      .limit(1)
    return results[0] ?? null
  }

  async findLatestByConversation(
    conversationId: string,
    limit = 10
  ): Promise<Message[]> {
    return (this.db as any)
      .select()
      .from(this.schema.messages)
      .where(eq(this.schema.messages.conversationId, conversationId))
      .orderBy(desc(this.schema.messages.createdAt))
      .limit(limit)
  }

  async create(data: NewMessage): Promise<Message> {
    const results = await (this.db as any)
      .insert(this.schema.messages)
      .values(data)
      .returning()
    return results[0]
  }

  async createMany(data: NewMessage[]): Promise<Message[]> {
    if (data.length === 0) return []
    const results = await (this.db as any)
      .insert(this.schema.messages)
      .values(data)
      .returning()
    return results
  }

  async delete(id: string): Promise<void> {
    await (this.db as any)
      .delete(this.schema.messages)
      .where(eq(this.schema.messages.id, id))
  }

  async deleteByConversation(conversationId: string): Promise<void> {
    await (this.db as any)
      .delete(this.schema.messages)
      .where(eq(this.schema.messages.conversationId, conversationId))
  }

  async countByConversation(conversationId: string): Promise<number> {
    const results = await (this.db as any)
      .select()
      .from(this.schema.messages)
      .where(eq(this.schema.messages.conversationId, conversationId))
    return results.length
  }
}
