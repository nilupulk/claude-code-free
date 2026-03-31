import { eq, sql } from 'drizzle-orm'
import type { DbConnection, ActiveSchema } from '../connection.js'
import type { SharedLink, NewSharedLink } from '../types.js'

export class SharedLinkRepository {
  constructor(
    private db: DbConnection,
    private schema: ActiveSchema
  ) {}

  async findById(id: string): Promise<SharedLink | null> {
    const results = await (this.db as any)
      .select()
      .from(this.schema.sharedLinks)
      .where(eq(this.schema.sharedLinks.id, id))
      .limit(1)
    return results[0] ?? null
  }

  async findByConversation(conversationId: string): Promise<SharedLink[]> {
    return (this.db as any)
      .select()
      .from(this.schema.sharedLinks)
      .where(eq(this.schema.sharedLinks.conversationId, conversationId))
  }

  async findByUser(userId: string): Promise<SharedLink[]> {
    return (this.db as any)
      .select()
      .from(this.schema.sharedLinks)
      .where(eq(this.schema.sharedLinks.createdBy, userId))
  }

  async create(data: NewSharedLink): Promise<SharedLink> {
    const results = await (this.db as any)
      .insert(this.schema.sharedLinks)
      .values(data)
      .returning()
    return results[0]
  }

  async incrementViewCount(id: string): Promise<void> {
    await (this.db as any)
      .update(this.schema.sharedLinks)
      .set({
        viewCount: sql`${this.schema.sharedLinks.viewCount} + 1`,
      })
      .where(eq(this.schema.sharedLinks.id, id))
  }

  async delete(id: string): Promise<void> {
    await (this.db as any)
      .delete(this.schema.sharedLinks)
      .where(eq(this.schema.sharedLinks.id, id))
  }

  async deleteByConversation(conversationId: string): Promise<void> {
    await (this.db as any)
      .delete(this.schema.sharedLinks)
      .where(eq(this.schema.sharedLinks.conversationId, conversationId))
  }

  isExpired(link: SharedLink): boolean {
    if (!link.expiresAt) return false
    return new Date(link.expiresAt as string) < new Date()
  }
}
