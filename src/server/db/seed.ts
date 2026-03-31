/**
 * Development seed data.
 * Run with: npm run db:seed
 */
import { connect } from './connection.js'
import { UserRepository } from './repositories/user.js'
import { ConversationRepository } from './repositories/conversation.js'
import { MessageRepository } from './repositories/message.js'
import { ToolUseRepository } from './repositories/tool-use.js'

async function seed() {
  const { db, schema, dbType } = connect()

  console.log(`Seeding ${dbType} database…`)

  const userRepo = new UserRepository(db, schema)
  const conversationRepo = new ConversationRepository(db, schema, dbType)
  const messageRepo = new MessageRepository(db, schema)
  const toolUseRepo = new ToolUseRepository(db, schema)

  // ── Users ──────────────────────────────────────────────────
  const alice = await userRepo.upsertByEmail({
    email: 'alice@example.com',
    name: 'Alice Dev',
    role: 'admin',
    preferences: { theme: 'dark', fontSize: 14 } as any,
  })
  console.log(`  user: ${alice.email} (${alice.id})`)

  const bob = await userRepo.upsertByEmail({
    email: 'bob@example.com',
    name: 'Bob Tester',
    role: 'user',
    preferences: { theme: 'light', fontSize: 13 } as any,
  })
  console.log(`  user: ${bob.email} (${bob.id})`)

  // ── Conversations ──────────────────────────────────────────
  const conv1 = await conversationRepo.create({
    userId: alice.id,
    title: 'Refactor authentication module',
    model: 'claude-opus-4-6',
    systemPrompt: 'You are an expert TypeScript engineer.',
    isPinned: true,
    tags: ['backend', 'auth'] as any,
    messageCount: 0,
    tokenCount: 0,
  })
  console.log(`  conversation: "${conv1.title}" (${conv1.id})`)

  const conv2 = await conversationRepo.create({
    userId: alice.id,
    title: 'Debug memory leak in session store',
    model: 'claude-sonnet-4-6',
    messageCount: 0,
    tokenCount: 0,
  })
  console.log(`  conversation: "${conv2.title}" (${conv2.id})`)

  const conv3 = await conversationRepo.create({
    userId: bob.id,
    title: 'Write unit tests for UserRepository',
    model: 'claude-sonnet-4-6',
    messageCount: 0,
    tokenCount: 0,
  })
  console.log(`  conversation: "${conv3.title}" (${conv3.id})`)

  // ── Messages ───────────────────────────────────────────────
  const msg1 = await messageRepo.create({
    conversationId: conv1.id,
    role: 'user',
    content: [{ type: 'text', text: 'Can you help me refactor the auth module to use JWT?' }] as any,
  })

  const msg2 = await messageRepo.create({
    conversationId: conv1.id,
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: "Sure! Here's how we can refactor the auth module to use JWT tokens...",
      },
    ] as any,
    model: 'claude-opus-4-6',
    inputTokens: 120,
    outputTokens: 450,
    stopReason: 'end_turn',
    durationMs: 2100,
  })

  const msg3 = await messageRepo.create({
    conversationId: conv1.id,
    role: 'user',
    content: [{ type: 'text', text: 'Can you also read the current auth.ts file first?' }] as any,
  })

  const msg4 = await messageRepo.create({
    conversationId: conv1.id,
    role: 'assistant',
    content: [
      { type: 'text', text: "Of course, let me read that file for you." },
      { type: 'tool_use', id: 'tu_01', name: 'Read', input: { file_path: 'src/server/web/auth/adapter.ts' } },
    ] as any,
    model: 'claude-opus-4-6',
    inputTokens: 200,
    outputTokens: 80,
    stopReason: 'tool_use',
    durationMs: 800,
  })

  // ── Tool Uses ──────────────────────────────────────────────
  await toolUseRepo.create({
    messageId: msg4.id,
    toolName: 'Read',
    input: { file_path: 'src/server/web/auth/adapter.ts' } as any,
    output: { content: '// auth adapter contents…' } as any,
    status: 'success',
    durationMs: 45,
  })

  // Update conversation message counts
  await conversationRepo.update(conv1.id, { messageCount: 4, tokenCount: 850 })
  await conversationRepo.update(conv3.id, { messageCount: 0, tokenCount: 0 })

  console.log('\nSeed complete.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
