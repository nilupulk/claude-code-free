// scripts/test-tools.ts
// Verify all tools load without errors and core tools are present.
// Usage: bun scripts/test-tools.ts
//
// The bun:bundle shim is loaded automatically via bunfig.toml preload.

// Load MACRO global before any app code
import '../src/shims/macro.js'

// Provide minimal env vars required for tool loading:
// - isEnabled() on some tools (e.g. WebSearchTool) reads auth config
// - config guard allows access when NODE_ENV=test
process.env.NODE_ENV ??= 'test'
process.env.ANTHROPIC_API_KEY ??= 'smoke-test-key'

async function main() {
  const { getTools, getAllBaseTools } = await import('../src/tools.js')
  const { getEmptyToolPermissionContext } = await import('../src/Tool.js')

  const permissionContext = getEmptyToolPermissionContext()

  // getAllBaseTools() returns the full set before permission filtering
  const allTools = getAllBaseTools()
  // getTools() applies permission context filtering and isEnabled() checks
  const tools = getTools(permissionContext)

  console.log(`All base tools: ${allTools.length}`)
  console.log(`Available tools (after permission filter): ${tools.length}\n`)

  console.log('Tools loaded:\n')
  for (const tool of tools) {
    console.log(`  ✓ ${tool.name}`)
  }

  // Verify the core 10 essential tools are present
  const coreTen = [
    'Bash',
    'Read',
    'Write',
    'Edit',
    'Glob',
    'Grep',
    'Agent',
    'WebFetch',
    'AskUserQuestion',
    'TodoWrite',
  ]

  console.log('\nChecking core tools:')
  const toolNames = new Set(tools.map(t => t.name))
  const missing: string[] = []

  for (const name of coreTen) {
    if (toolNames.has(name)) {
      console.log(`  ✓ ${name}`)
    } else {
      console.log(`  ✗ ${name} — MISSING`)
      missing.push(name)
    }
  }

  if (missing.length > 0) {
    console.error(`\n❌ Missing core tools: ${missing.join(', ')}`)
    process.exit(1)
  }

  console.log(`\n✅ All ${coreTen.length} core tools present`)
  console.log(`✅ Tool system loaded successfully (${tools.length} tools available)`)
}

main().catch(err => {
  console.error('❌ Tool loading failed:', err)
  process.exit(1)
})
