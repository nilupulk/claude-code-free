import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import type {
  users as pgUsers,
  conversations as pgConversations,
  messages as pgMessages,
  toolUses as pgToolUses,
  sessions as pgSessions,
  sharedLinks as pgSharedLinks,
} from './schema/postgres.js'

// Infer types from the PostgreSQL schema (canonical representation).
// SQLite uses the same field names and compatible JS types so these work for both.
export type User = InferSelectModel<typeof pgUsers>
export type NewUser = InferInsertModel<typeof pgUsers>

export type Conversation = InferSelectModel<typeof pgConversations>
export type NewConversation = InferInsertModel<typeof pgConversations>

export type Message = InferSelectModel<typeof pgMessages>
export type NewMessage = InferInsertModel<typeof pgMessages>

export type ToolUse = InferSelectModel<typeof pgToolUses>
export type NewToolUse = InferInsertModel<typeof pgToolUses>

export type Session = InferSelectModel<typeof pgSessions>
export type NewSession = InferInsertModel<typeof pgSessions>

export type SharedLink = InferSelectModel<typeof pgSharedLinks>
export type NewSharedLink = InferInsertModel<typeof pgSharedLinks>

export interface SearchFilters {
  model?: string
  dateFrom?: Date
  dateTo?: Date
  tags?: string[]
  isPinned?: boolean
}

export interface SearchResult {
  conversationId: string
  messageId: string
  snippet: string
  rank: number
  conversation: Pick<Conversation, 'id' | 'title' | 'createdAt' | 'updatedAt'>
}

export interface PaginationOptions {
  limit?: number
  offset?: number
}
