# Ink Terminal UI Render Pipeline

## Overview

Claude Code renders its TUI using **React + Ink** — a framework that mounts React trees to the
terminal instead of the browser DOM. This project embeds a custom fork of Ink in `src/ink/`.

## Entry Points

| File | Role |
|---|---|
| `src/ink.ts` | Public API — re-exports `render()` / `createRoot()`, wraps every tree with `ThemeProvider` |
| `src/ink/root.ts` | Manages `Ink` class instances; keyed by stdout stream |
| `src/ink/ink.tsx` | Core `Ink` class — owns the React root, terminal I/O, layout, and frame output |
| `src/ink/reconciler.ts` | React reconciler that maps React elements → `DOMElement` / `TextNode` |
| `src/ink/dom.ts` | Terminal "DOM" nodes; each element owns a Yoga layout node |
| `src/ink/renderer.ts` | Converts the laid-out DOM tree into a 2-D screen buffer (`Frame`) |
| `src/ink/render-node-to-output.ts` | Walks the DOM tree and paints styled text into an `Output` grid |
| `src/ink/log-update.ts` | Diffs the new frame against the previous one and writes minimal ANSI escapes |

## Render Pipeline

```
Your Component
     │
     ▼
src/ink.ts :: render(node)
  └─ wraps node with ThemeProvider
  └─ calls inkRender() (async — preserves microtask boundary)
        │
        ▼
src/ink/root.ts :: renderSync(node, opts)
  └─ creates or reuses an Ink instance keyed by stdout
  └─ registers instance in global instances Map
        │
        ▼
src/ink/ink.tsx :: Ink#render(node)
  └─ calls React reconciler.updateContainerSync()
        │
        ▼
src/ink/reconciler.ts  (react-reconciler v0.31 host)
  ├─ createInstance()    → createNode()  (DOMElement + Yoga node)
  ├─ createTextInstance()→ createTextNode() (TextNode, no Yoga)
  ├─ appendChild/insertBefore/removeChild → mirrors into Yoga tree
  └─ resetAfterCommit()  → calls ink.onComputeLayout() + ink.onRender()
        │
        ▼
src/ink/dom.ts  (Virtual DOM)
  ├─ DOMElement  { nodeName, attributes, childNodes, style, yogaNode, ... }
  └─ TextNode    { '#text', nodeValue }
        │
        ▼
src/native-ts/yoga-layout/  (Yoga flexbox engine)
  └─ calculateLayout() — computes x/y/width/height for every DOMElement
        │
        ▼
src/ink/renderer.ts :: createRenderer()(frameOptions)
  ├─ validates computed dimensions
  ├─ builds Output screen buffer
  └─ calls renderNodeToOutput() to paint each node
        │
        ▼
src/ink/render-node-to-output.ts
  └─ recursively walks DOMElement tree, applying text styles via chalk
        │
        ▼
src/ink/log-update.ts :: LogUpdate#render(frame)
  └─ diffs new frame against prevFrame
  └─ writes minimal ANSI cursor-move + text sequences to stdout
```

## Key Design Decisions

1. **ThemeProvider injection** — `src/ink.ts` wraps every render call so all
   `ThemedBox` / `ThemedText` components have a theme context without requiring
   every call site to mount it manually.

2. **Instance cache by stdout** — `instances` Map lets external code (e.g. the IDE
   bridge) look up and pause/resume the right Ink instance.

3. **Microtask boundary** — `render()` and `createRoot()` both `await Promise.resolve()`
   before the first render so async startup work (hook state, REPL bridge) settles first.

4. **Yoga without WASM** — Layout is provided by a native TypeScript/JS port in
   `src/native-ts/yoga-layout/`, not the WebAssembly build, so no WASM loading latency.

5. **Reconciler-driven layout** — `resetAfterCommit()` triggers Yoga layout
   recalculation after every React commit, so layout and React commit phases stay in sync.

6. **Incremental blit** — The renderer diffs frames at character-cell granularity
   so unchanged terminal rows are never rewritten.

## Custom JSX Intrinsic Elements

Ink registers custom React host elements. These must be declared in the JSX namespace:

| Element | Purpose |
|---|---|
| `ink-root` | Root container; owns the `FocusManager` |
| `ink-box` | Flexbox layout container (maps to `<Box>`) |
| `ink-text` | Leaf text node (maps to `<Text>`) |
| `ink-virtual-text` | Text with no Yoga layout (inline; no size contribution) |
| `ink-link` | Hyperlink OSC sequence wrapper |
| `ink-progress` | Progress bar primitive |
| `ink-raw-ansi` | Raw pre-rendered ANSI string (bypasses text measurement) |

Global type declarations for these live in `src/ink/global.d.ts`.

## Component Layers

```
src/ink/components/   — Base Ink primitives (Box, Text, Button, ScrollBox, …)
src/components/design-system/  — Themed wrappers (ThemedBox, ThemedText, ThemeProvider)
src/components/       — ~140 Claude Code application components
```

Application components import `{ Box, Text }` from `src/ink.ts`, which re-exports the
themed wrappers. Lower-level code can import `{ BaseBox, BaseText }` to bypass theming.
