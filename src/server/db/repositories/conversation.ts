import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import type { DbConnection, ActiveSchema, DbType } from '../connection.js'
import type {
  Conversation,
  NewConversation,
  PaginationOptions,
  SearchFilters,
  SearchResult,
} from '../types.js'

export class ConversationRepository {
  constructor(
    private db: DbConnection,
    private schema: ActiveSchema,
    private dbType: DbType
  ) {}

  async findByUser(
    userId: string,
    options: PaginationOptions & { search?: string } = {}
  ): Promise<Conversation[]> {
    const { limit = 50, offset = 0, search } = options
    const conditions = [eq(this.schema.conversations.userId, userId)]

    if (search) {
      conditions.push(
        ilike(this.schema.conversations.title, `%${search}%`) as any
      )
    }

    return (this.db as any)
      .select()
      .from(this.schema.conversations)
      .where(and(...conditions))
      .orderBy(desc(this.schema.conversations.updatedAt))
      .limit(limit)
      .offset(offset)
  }

  async findById(id: string): Promise<Conversation | null> {
    const results = await (this.db as any)
      .select()
      .from(this.schema.conversations)
      .where(eq(this.schema.conversations.id, id))
      .limit(1)
    return results[0] ?? null
  }

  async create(data: NewConversation): Promise<Conversation> {
    const results = await (this.db as any)
      .insert(this.schema.conversations)
      .values(data)
      .returning()
    return results[0]
  }

  async update(id: string, data: Partial<NewConversation>): Promise<Conversation | null> {
    const results = await (this.db as any)
      .update(this.schema.conversations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(this.schema.conversations.id, id))
      .returning()
    return results[0] ?? null
  }

  async delete(id: string): Promise<void> {
    await (this.db as any)
      .delete(this.schema.conversations)
      .where(eq(this.schema.conversations.id, id))
  }

  async incrementMessageCount(id: string, tokenDelta = 0): Promise<void> {
    await (this.db as any)
      .update(this.schema.conversations)
      .set({
        messageCount: sql`${this.schema.conversations.messageCount} + 1`,
        tokenCount: sql`${this.schema.conversations.tokenCount} + ${tokenDelta}`,
        updatedAt: new Date(),
      })
      .where(eq(this.schema.conversations.id, id))
  }

  async search(
    userId: string,
    query: string,
    filters: SearchFilters = {}
  ): Promise<SearchResult[]> {
    if (this.dbType === 'postgres') {
      return this._searchPostgres(userId, query, filters)
    }
    return this._searchSqlite(userId, query, filters)
  }

  private async _searchPostgres(
    userId: string,
    query: string,
    _filters: SearchFilters
  ): Promise<SearchResult[]> {
    // Full-text search using PostgreSQL tsvector
    const rows = await (this.db as any).execute(sql`
      SELECT
        m.conversation_id AS "conversationId",
        m.id              AS "messageId",
        ts_headline('english', m.content::text, plainto_tsquery('english', ${query}),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15'
        ) AS snippet,
        ts_rank(to_tsvector('english', m.content::text), plainto_tsquery('english', ${query})) AS rank,
        c.id AS "cId", c.title AS "cTitle",
        c.created_at AS "cCreatedAt", c.updated_at AS "cUpdatedAt"
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.user_id = ${userId}
        AND to_tsvector('english', m.content::text) @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT 50
    `)

    return rows.map((r: any) => ({
      conversationId: r.conversationId,
      messageId: r.messageId,
      snippet: r.snippet,
      rank: Number(r.rank),
      conversation: {
        id: r.cId,
        title: r.cTitle,
        createdAt: r.cCreatedAt,
        updatedAt: r.cUpdatedAt,
      },
    }))
  }

  private async _searchSqlite(
    userId: string,
    query: string,
    _filters: SearchFilters
  ): Promise<SearchResult[]> {
    // SQLite LIKE-based search (FTS5 requires separate virtual table setup)
    const pattern = `%${query}%`
    const rows = await (this.db as any).execute(sql`
      SELECT
        m.conversation_id AS conversationId,
        m.id              AS messageId,
        substr(m.content, 1, 200) AS snippet,
        1.0 AS rank,
        c.id AS cId, c.title AS cTitle,
        c.created_at AS cCreatedAt, c.updated_at AS cUpdatedAt
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.user_id = ${userId}
        AND m.content LIKE ${pattern}
      ORDER BY m.created_at DESC
      LIMIT 50
    `)

    return rows.map((r: any) => ({
      conversationId: r.conversationId,
      messageId: r.messageId,
      snippet: String(r.snippet ?? ''),
      rank: 1,
      conversation: {
        id: r.cId,
        title: r.cTitle,
        createdAt: r.cCreatedAt,
        updatedAt: r.cUpdatedAt,
      },
    }))
  }
}
