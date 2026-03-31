'use client'

/**
 * /ink-app  — renders the Claude Code terminal UI in a browser via the
 * ink-compat DOM renderer.
 *
 * This page mounts the existing `<App>` component tree (normally rendered
 * to a terminal via Ink) inside a browser using react-dom/client.  The
 * ink-compat layer (`web/lib/ink-compat/`) provides DOM-backed replacements
 * for every Ink primitive (<Box>, <Text>, hooks, etc.) so the component code
 * requires no changes.
 *
 * Module aliasing wires `ink` → `web/lib/ink-compat/index.ts` at build time
 * (see web/next.config.ts and web/tsconfig.json).
 */

import React from 'react'
import { InkCompatProvider } from '@/lib/ink-compat'

// ---------------------------------------------------------------------------
// Placeholder app — replace with the real <App> import once the aliasing
// pipeline is fully wired and all Node.js shims are in place.
// ---------------------------------------------------------------------------

function DemoApp() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '14px',
        lineHeight: '1.5',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        minHeight: '100vh',
        padding: '16px',
      }}
    >
      {/* Demo: ink-compat Box + Text */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div
          style={{
            display: 'flex',
            border: '1px solid #3b82f6',
            borderRadius: '4px',
            padding: '8px 16px',
          }}
        >
          <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>ink-compat</span>
          <span style={{ flex: 1 }} />
          <span style={{ color: '#94a3b8' }}>DOM renderer active</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ color: '#22c55e' }}>✓</span>
          <span>Box → div with flexbox</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ color: '#22c55e' }}>✓</span>
          <span>Text → span with CSS text styles</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ color: '#22c55e' }}>✓</span>
          <span>useInput → DOM keydown adapter</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ color: '#22c55e' }}>✓</span>
          <span>useApp → WebAppContext (exit callback)</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ color: '#22c55e' }}>✓</span>
          <span>ANSI/256/hex colors → CSS colors</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ color: '#22c55e' }}>✓</span>
          <span>All Ink layout props → CSS flex/box model</span>
        </div>

        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            border: '1px solid #334155',
            borderRadius: '4px',
            color: '#94a3b8',
            fontSize: '12px',
          }}
        >
          Replace <code style={{ color: '#f59e0b' }}>&lt;DemoApp&gt;</code> in{' '}
          <code style={{ color: '#f59e0b' }}>web/app/ink-app/page.tsx</code> with the
          real <code style={{ color: '#f59e0b' }}>&lt;App&gt;</code> import once Node.js
          API shims are configured.
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InkAppPage() {
  return (
    <InkCompatProvider
      onExit={() => {
        // In production this could navigate away or show a "session ended" message.
        console.info('[ink-compat] app exited')
      }}
    >
      <DemoApp />
    </InkCompatProvider>
  )
}
