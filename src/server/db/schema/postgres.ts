import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique(),
  name: varchar('name', { length: 255 }),
  avatar: varchar('avatar', { length: 500 }),
  role: varchar('role', { length: 50 }).default('user'),
  anthropicApiKey: text('anthropic_api_key'),
  preferences: jsonb('preferences').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id),
    title: varchar('title', { length: 500 }),
    model: varchar('model', { length: 100 }),
    systemPrompt: text('system_prompt'),
    isPinned: boolean('is_pinned').default(false),
    tags: jsonb('tags').default([]),
    metadata: jsonb('metadata').default({}),
    messageCount: integer('message_count').default(0),
    tokenCount: integer('token_count').default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    index('idx_conversations_user_id').on(t.userId),
    index('idx_conversations_updated_at').on(t.updatedAt),
  ]
)

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'cascade',
    }),
    role: varchar('role', { length: 20 }),
    content: jsonb('content'),
    model: varchar('model', { length: 100 }),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    stopReason: varchar('stop_reason', { length: 50 }),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    index('idx_messages_conversation_id').on(t.conversationId),
    index('idx_messages_created_at').on(t.createdAt),
  ]
)

export const toolUses = pgTable(
  'tool_uses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id').references(() => messages.id, {
      onDelete: 'cascade',
    }),
    toolName: varchar('tool_name', { length: 100 }),
    input: jsonb('input'),
    output: jsonb('output'),
    status: varchar('status', { length: 20 }),
    durationMs: integer('duration_ms'),
    approvedBy: uuid('approved_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [index('idx_tool_uses_message_id').on(t.messageId)]
)

export const sessions = pgTable(
  'sessions',
  {
    id: varchar('id', { length: 128 }).primaryKey(),
    userId: uuid('user_id').references(() => users.id),
    data: jsonb('data'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [index('idx_sessions_expires_at').on(t.expiresAt)]
)

export const sharedLinks = pgTable('shared_links', {
  id: varchar('id', { length: 32 }).primaryKey(),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  createdBy: uuid('created_by').references(() => users.id),
  accessLevel: varchar('access_level', { length: 20 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  expiresAt: timestamp('expires_at'),
  viewCount: integer('view_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
})

export type PgSchema = {
  users: typeof users
  conversations: typeof conversations
  messages: typeof messages
  toolUses: typeof toolUses
  sessions: typeof sessions
  sharedLinks: typeof sharedLinks
}

export const pgSchema: PgSchema = {
  users,
  conversations,
  messages,
  toolUses,
  sessions,
  sharedLinks,
}
