// scripts/node-preload.mjs
// ESM initialization module — registers the bun:bundle loader hook.
// Load with:  node --import ./scripts/node-preload.mjs  (or tsx --import)

import { register } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

register('./node-loader-hook.mjs', pathToFileURL(__dirname + '/'))
