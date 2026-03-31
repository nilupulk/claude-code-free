import { describe, it, expect, beforeAll } from 'vitest'

const API_KEY = process.env.ANTHROPIC_API_KEY

describe.skipIf(!API_KEY)('Anthropic API integration', () => {
  let Anthropic: typeof import('@anthropic-ai/sdk').default

  beforeAll(async () => {
    const mod = await import('@anthropic-ai/sdk')
    Anthropic = mod.default
  })

  it('creates an API client successfully', () => {
    const client = new Anthropic({ apiKey: API_KEY })
    expect(client).toBeDefined()
  })

  it('sends a simple message and gets a response', async () => {
    const client = new Anthropic({ apiKey: API_KEY })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
    })
    expect(response.content.length).toBeGreaterThan(0)
    expect(response.content[0].type).toBe('text')
    const text = (response.content[0] as { type: 'text'; text: string }).text
    expect(text.toLowerCase()).toContain('hello')
  })

  it('streams a response without error', async () => {
    const client = new Anthropic({ apiKey: API_KEY })
    const chunks: string[] = []
    const stream = await client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 32,
      messages: [{ role: 'user', content: 'Count to 3.' }],
    })
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        chunks.push(event.delta.text)
      }
    }
    expect(chunks.length).toBeGreaterThan(0)
  })

  it('handles tool use (calculator-style)', async () => {
    const client = new Anthropic({ apiKey: API_KEY })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      tools: [
        {
          name: 'add',
          description: 'Add two numbers together',
          input_schema: {
            type: 'object' as const,
            properties: {
              a: { type: 'number', description: 'First number' },
              b: { type: 'number', description: 'Second number' },
            },
            required: ['a', 'b'],
          },
        },
      ],
      messages: [{ role: 'user', content: 'What is 7 + 5? Use the add tool.' }],
    })
    const hasToolUse = response.content.some(b => b.type === 'tool_use')
    expect(hasToolUse).toBe(true)
  })
})
