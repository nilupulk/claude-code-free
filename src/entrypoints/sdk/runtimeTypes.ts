/**
 * Runtime types for the Claude Code Agent SDK.
 * Non-serializable types: callbacks, session interfaces, option objects.
 *
 * NOTE: This file is a stub — the full implementation lives in the SDK
 * package. These type definitions exist so the source tree typechecks
 * without requiring the built SDK package.
 */

import type { z } from 'zod'
import type { SDKMessage, SDKResultMessage, SDKSessionInfo, SDKUserMessage } from './coreTypes.js'

// ============================================================================
// Zod helpers
// ============================================================================

export type AnyZodRawShape = z.ZodRawShape
export type InferShape<T extends AnyZodRawShape> = {
  [K in keyof T]: z.infer<T[K]>
}

// ============================================================================
// MCP tool types
// ============================================================================

export type SdkMcpToolDefinition<Schema extends AnyZodRawShape = AnyZodRawShape> = {
  name: string
  description: string
  inputSchema: Schema
  handler: (args: InferShape<Schema>, extra: unknown) => Promise<unknown>
}

export type McpSdkServerConfigWithInstance = {
  name: string
  version?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Array<SdkMcpToolDefinition<any>>
  instance: unknown
}

// ============================================================================
// Session types (V2 API - UNSTABLE)
// ============================================================================

export type SDKSessionOptions = {
  cwd?: string
  model?: string
  maxTurns?: number
  systemPrompt?: string
  appendSystemPrompt?: string
  permissionMode?: string
  allowedTools?: string[]
  disallowedTools?: string[]
  mcpServers?: unknown[]
  verbose?: boolean
  apiKey?: string
}

export type SDKSession = {
  id: string
  prompt(message: string): AsyncGenerator<SDKMessage>
  getMessages(): Promise<SessionMessage[]>
  abort(): void
}

// ============================================================================
// Query types (internal SDK query API)
// ============================================================================

export type Options = SDKSessionOptions & {
  onMessage?: (msg: SDKMessage) => void
}

export type InternalOptions = Options & {
  _internal?: unknown
}

export type Query = AsyncGenerator<SDKMessage, SDKResultMessage | undefined>
export type InternalQuery = Query

// ============================================================================
// Session management types
// ============================================================================

export type SessionMessage = {
  role: 'user' | 'assistant'
  content: unknown
  uuid?: string
  timestamp?: number
}

export type ListSessionsOptions = {
  dir?: string
  limit?: number
  offset?: number
}

export type GetSessionMessagesOptions = {
  dir?: string
  limit?: number
  offset?: number
  includeSystemMessages?: boolean
}

export type GetSessionInfoOptions = {
  dir?: string
}

export type SessionMutationOptions = {
  dir?: string
}

export type ForkSessionOptions = {
  dir?: string
  upToMessageId?: string
  title?: string
}

export type ForkSessionResult = {
  sessionId: string
}

// Re-export SDKUserMessage so agentSdkTypes can use it in function signatures
export type { SDKUserMessage, SDKSessionInfo }
