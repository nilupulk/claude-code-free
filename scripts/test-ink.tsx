// scripts/test-ink.tsx
// Minimal test that the Ink terminal UI renders
// Usage: bun scripts/test-ink.tsx
//
// bunfig.toml automatically preloads scripts/bun-plugin-shims.ts which
// intercepts `bun:bundle` imports → src/shims/bun-bundle.ts (feature flags).

// Load MACRO global (version, package url, etc.) before any app code
import '../src/shims/preload.js'

// Suppress config-guard checks (same pattern as test-services.ts)
process.env.NODE_ENV = process.env.NODE_ENV || 'test'

import React from 'react'
// Text and Box are re-exported from src/ink.ts as ThemedText/ThemedBox
import { render, Text, Box } from '../src/ink.js'

function Hello() {
  return (
    <Box flexDirection="column">
      <Text>Hello from Claude Code Ink UI!</Text>
      <Text dimColor>Ink + React terminal rendering pipeline is working.</Text>
    </Box>
  )
}

async function main() {
  const instance = await render(<Hello />)
  // Give Ink a moment to flush the frame to stdout
  setTimeout(() => {
    instance.unmount()
    process.exit(0)
  }, 500)
}

main().catch(err => {
  console.error('Ink render test failed:', err)
  process.exit(1)
})
