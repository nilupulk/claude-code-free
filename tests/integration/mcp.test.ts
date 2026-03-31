import { describe, it, expect } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

function createEchoServer() {
  const server = new Server(
    { name: 'test-echo-server', version: '0.0.1' },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'echo',
        description: 'Returns its input unchanged',
        inputSchema: {
          type: 'object' as const,
          properties: { message: { type: 'string' } },
          required: ['message'],
        },
      },
    ],
  }))

  server.setRequestHandler(CallToolRequestSchema, async request => ({
    content: [{ type: 'text', text: (request.params.arguments as any).message }],
  }))

  return server
}

describe('MCP in-process roundtrip', () => {
  it('client connects to server', async () => {
    const server = createEchoServer()
    const client = new Client(
      { name: 'test-client', version: '0.0.1' },
      { capabilities: {} },
    )

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

    expect(client.getServerVersion()).toBeDefined()
    await client.close()
    await server.close()
  })

  it('lists tools from the server', async () => {
    const server = createEchoServer()
    const client = new Client(
      { name: 'test-client', version: '0.0.1' },
      { capabilities: {} },
    )

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

    const result = await client.listTools()
    expect(Array.isArray(result.tools)).toBe(true)
    expect(result.tools.some(t => t.name === 'echo')).toBe(true)

    await client.close()
    await server.close()
  })

  it('executes a tool call roundtrip', async () => {
    const server = createEchoServer()
    const client = new Client(
      { name: 'test-client', version: '0.0.1' },
      { capabilities: {} },
    )

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

    const result = await client.callTool({ name: 'echo', arguments: { message: 'ping' } })

    expect(Array.isArray(result.content)).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>).find(
      b => b.type === 'text',
    )
    expect(text?.text).toBe('ping')

    await client.close()
    await server.close()
  })
})
