import { eq } from 'drizzle-orm'
import type { DbConnection, ActiveSchema } from '../connection.js'
import type { ToolUse, NewToolUse } from '../types.js'

export class ToolUseRepository {
  constructor(
    private db: DbConnection,
    private schema: ActiveSchema
  ) {}

  async findByMessage(messageId: string): Promise<ToolUse[]> {
    return (this.db as any)
      .select()
      .from(this.schema.toolUses)
      .where(eq(this.schema.toolUses.messageId, messageId))
  }

  async findById(id: string): Promise<ToolUse | null> {
    const results = await (this.db as any)
      .select()
      .from(this.schema.toolUses)
      .where(eq(this.schema.toolUses.id, id))
      .limit(1)
    return results[0] ?? null
  }

  async create(data: NewToolUse): Promise<ToolUse> {
    const results = await (this.db as any)
      .insert(this.schema.toolUses)
      .values(data)
      .returning()
    return results[0]
  }

  async updateStatus(
    id: string,
    status: 'success' | 'error' | 'cancelled',
    output?: unknown
  ): Promise<ToolUse | null> {
    const results = await (this.db as any)
      .update(this.schema.toolUses)
      .set({ status, ...(output !== undefined ? { output } : {}) })
      .where(eq(this.schema.toolUses.id, id))
      .returning()
    return results[0] ?? null
  }

  async approve(id: string, approvedBy: string): Promise<ToolUse | null> {
    const results = await (this.db as any)
      .update(this.schema.toolUses)
      .set({ approvedBy })
      .where(eq(this.schema.toolUses.id, id))
      .returning()
    return results[0] ?? null
  }

  async delete(id: string): Promise<void> {
    await (this.db as any)
      .delete(this.schema.toolUses)
      .where(eq(this.schema.toolUses.id, id))
  }
}
