export { connect, getDb, getSchema, getDbType } from './connection.js'
export type { DbConnection, ActiveSchema, DbType } from './connection.js'
export type {
  User, NewUser,
  Conversation, NewConversation,
  Message, NewMessage,
  ToolUse, NewToolUse,
  Session, NewSession,
  SharedLink, NewSharedLink,
  SearchFilters,
  SearchResult,
  PaginationOptions,
} from './types.js'
export { UserRepository } from './repositories/user.js'
export { ConversationRepository } from './repositories/conversation.js'
export { MessageRepository } from './repositories/message.js'
export { ToolUseRepository } from './repositories/tool-use.js'
export { SessionRepository } from './repositories/session.js'
export { SharedLinkRepository } from './repositories/shared-link.js'
export { pgSchema } from './schema/postgres.js'
export { sqliteSchema } from './schema/sqlite.js'

import { connect } from './connection.js'
import { UserRepository } from './repositories/user.js'
import { ConversationRepository } from './repositories/conversation.js'
import { MessageRepository } from './repositories/message.js'
import { ToolUseRepository } from './repositories/tool-use.js'
import { SessionRepository } from './repositories/session.js'
import { SharedLinkRepository } from './repositories/shared-link.js'

/**
 * Initialise the database and return a fully-wired set of repositories.
 * Call once at server startup and pass the result through dependency injection.
 *
 * @example
 * ```ts
 * import { initDb } from './db/index.js'
 * const { repos } = initDb()
 * const user = await repos.users.findByEmail('alice@example.com')
 * ```
 */
export function initDb() {
  const { db, schema, dbType } = connect()

  const repos = {
    users: new UserRepository(db, schema),
    conversations: new ConversationRepository(db, schema, dbType),
    messages: new MessageRepository(db, schema),
    toolUses: new ToolUseRepository(db, schema),
    sessions: new SessionRepository(db, schema),
    sharedLinks: new SharedLinkRepository(db, schema),
  }

  return { db, schema, dbType, repos }
}
