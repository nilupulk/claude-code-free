// scripts/test-query.ts
// Minimal test of the QueryEngine — single query, no REPL
// Usage: ANTHROPIC_API_KEY=sk-ant-... bun scripts/test-query.ts "What is 2+2?"

// Must load shims before any application code
import '../src/shims/preload.js'

async function main() {
  const query = process.argv[2] || 'What is 2+2?'

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required')
    console.error('Usage: ANTHROPIC_API_KEY=sk-ant-... bun scripts/test-query.ts "Your question"')
    process.exit(1)
  }

  // Disable session persistence — don't write .jsonl transcript files
  const { setSessionPersistenceDisabled } = await import('../src/bootstrap/state.js')
  setSessionPersistenceDisabled(true)

  // enableConfigs() must be called before any config/settings reads
  const { enableConfigs } = await import('../src/utils/config.js')
  enableConfigs()

  // Import core dependencies
  const { ask } = await import('../src/QueryEngine.js')
  const { getDefaultAppState } = await import('../src/state/AppStateStore.js')
  const { getAllBaseTools } = await import('../src/tools.js')
  const { getCommands } = await import('../src/commands.js')
  const {
    createFileStateCacheWithSizeLimit,
    READ_FILE_STATE_CACHE_SIZE,
  } = await import('../src/utils/fileStateCache.js')

  const cwd = process.cwd()

  // Minimal AppState — use getDefaultAppState() for all required fields
  let appState = getDefaultAppState()
  const getAppState = () => appState
  const setAppState = (f: (prev: typeof appState) => typeof appState) => {
    appState = f(appState)
  }

  // Read file cache — tracks which files the model has seen
  let readFileCache = createFileStateCacheWithSizeLimit(READ_FILE_STATE_CACHE_SIZE)
  const getReadFileCache = () => readFileCache
  const setReadFileCache = (cache: typeof readFileCache) => {
    readFileCache = cache
  }

  // canUseTool — allow all tools unconditionally for this test
  // Real usage would prompt the user for permission on dangerous tools
  const canUseTool = async () => ({ behavior: 'allow' as const })

  // Load tools and commands
  const tools = getAllBaseTools()
  const commands = await getCommands(cwd)

  console.log(`Query: ${query}`)
  console.log('---')

  let streamingText = false

  // Ask the QueryEngine
  // With includePartialMessages: true, we get stream_event messages for real-time text
  for await (const message of ask({
    prompt: query,
    cwd,
    tools,
    commands,
    mcpClients: [],
    agents: [],
    canUseTool,
    getAppState,
    setAppState,
    getReadFileCache,
    setReadFileCache,
    includePartialMessages: true, // enables stream_event messages for streaming text
    verbose: false,
  })) {
    switch (message.type) {
      case 'stream_event': {
        const event = message.event
        // Print text deltas in real-time as they arrive from the API
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          process.stdout.write(event.delta.text)
          streamingText = true
        }
        // Thinking deltas — hide by default, uncomment to show
        // if (event.type === 'content_block_delta' && event.delta.type === 'thinking_delta') {
        //   process.stderr.write(`[thinking] ${event.delta.thinking}`)
        // }
        break
      }

      case 'assistant': {
        // Full assistant message — arrives after streaming completes for each turn.
        // Text was already printed via stream_event deltas above.
        // Only print if we weren't streaming (e.g., includePartialMessages was false).
        if (!streamingText) {
          for (const block of message.message.content) {
            if (block.type === 'text') {
              process.stdout.write(block.text)
            }
          }
        }
        // Reset flag for next turn (tool loop may trigger additional API calls)
        streamingText = false
        break
      }

      case 'user': {
        // Tool results — show which tools were called
        if (!message.isSynthetic) {
          console.log('\n[tool result received]')
        }
        break
      }

      case 'result': {
        // Final result summary
        console.log('\n---')
        if (message.subtype === 'success') {
          console.log(`Done. Turns: ${message.num_turns}, Cost: $${message.total_cost_usd.toFixed(6)}`)
          if (message.is_error) {
            console.log('(Note: response contained an API error)')
          }
        } else {
          console.log(`Error: ${message.subtype}`)
          if ('errors' in message) {
            for (const err of message.errors) {
              console.error(` - ${err}`)
            }
          }
        }
        break
      }

      case 'system': {
        // Init message — contains tool list, version info. Skip for clean output.
        break
      }

      // Other message types (tool_progress, rate_limit_event, etc.) — skip
    }
  }
}

main().catch(err => {
  console.error('Query test failed:', err)
  process.exit(1)
})
