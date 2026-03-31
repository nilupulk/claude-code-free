import {
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// SQLite doesn't have uuid, jsonb, or boolean native types.
// uuid → text, jsonb → text, boolean → integer (0/1), timestamp → text (ISO 8601)

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').unique(),
  name: text('name'),
  avatar: text('avatar'),
  role: text('role').default('user'),
  anthropicApiKey: text('anthropic_api_key'),
  preferences: text('preferences', { mode: 'json' }).default('{}'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
})

export const conversations = sqliteTable(
  'conversations',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id),
    title: text('title'),
    model: text('model'),
    systemPrompt: text('system_prompt'),
    isPinned: integer('is_pinned', { mode: 'boolean' }).default(false),
    tags: text('tags', { mode: 'json' }).default('[]'),
    metadata: text('metadata', { mode: 'json' }).default('{}'),
    messageCount: integer('message_count').default(0),
    tokenCount: integer('token_count').default(0),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').default(sql`(datetime('now'))`),
  },
  (t) => [
    index('idx_conversations_user_id').on(t.userId),
    index('idx_conversations_updated_at').on(t.updatedAt),
  ]
)

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    conversationId: text('conversation_id').references(
      () => conversations.id,
      { onDelete: 'cascade' }
    ),
    role: text('role'),
    content: text('content', { mode: 'json' }),
    model: text('model'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    stopReason: text('stop_reason'),
    durationMs: integer('duration_ms'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (t) => [
    index('idx_messages_conversation_id').on(t.conversationId),
    index('idx_messages_created_at').on(t.createdAt),
  ]
)

export const toolUses = sqliteTable(
  'tool_uses',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    messageId: text('message_id').references(() => messages.id, {
      onDelete: 'cascade',
    }),
    toolName: text('tool_name'),
    input: text('input', { mode: 'json' }),
    output: text('output', { mode: 'json' }),
    status: text('status'),
    durationMs: integer('duration_ms'),
    approvedBy: text('approved_by').references(() => users.id),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (t) => [index('idx_tool_uses_message_id').on(t.messageId)]
)

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id),
    data: text('data', { mode: 'json' }),
    expiresAt: text('expires_at'),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (t) => [index('idx_sessions_expires_at').on(t.expiresAt)]
)

export const sharedLinks = sqliteTable('shared_links', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').references(() => conversations.id),
  createdBy: text('created_by').references(() => users.id),
  accessLevel: text('access_level'),
  passwordHash: text('password_hash'),
  expiresAt: text('expires_at'),
  viewCount: integer('view_count').default(0),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
})

export type SqliteSchema = {
  users: typeof users
  conversations: typeof conversations
  messages: typeof messages
  toolUses: typeof toolUses
  sessions: typeof sessions
  sharedLinks: typeof sharedLinks
}

export const sqliteSchema: SqliteSchema = {
  users,
  conversations,
  messages,
  toolUses,
  sessions,
  sharedLinks,
}
