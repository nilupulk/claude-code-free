/**
 * web/app.tsx — Vite entry point
 *
 * Bootstrap sequence:
 *  1. Import global styles (terminal theme, Tailwind base)
 *  2. Create the React root and render <WebApp>
 *  3. <WebApp> initialises platform shims, fetches backend state, mounts UI
 *
 * This file is referenced by web/index.html as:
 *   <script type="module" src="/app.tsx"></script>
 *
 * Vite resolves the .tsx extension and handles JSX/TSX transformation via
 * @vitejs/plugin-react. In production `vite build` emits a fingerprinted
 * /assets/app-[hash].js that index.html links to instead.
 */

import './app.css'

import React from 'react'
import { createRoot } from 'react-dom/client'
import { WebApp } from './WebApp'

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const container = document.getElementById('root')
if (!container) {
  throw new Error(
    '[claude-code] Mount failed: <div id="root"> not found in index.html',
  )
}

const root = createRoot(container)

root.render(
  <React.StrictMode>
    <WebApp />
  </React.StrictMode>,
)

// ---------------------------------------------------------------------------
// Hot-module replacement (Vite HMR)
// ---------------------------------------------------------------------------
//
// Vite's @vitejs/plugin-react injects the Fast Refresh runtime automatically,
// so explicit `import.meta.hot` handling is only needed for side-effects that
// live outside React components. There are none here, so HMR works out of the
// box — edit any component and the browser updates without a full reload.
