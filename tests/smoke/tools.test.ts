import { describe, it, expect } from 'vitest'
import { BashTool } from '../../src/tools/BashTool/BashTool.js'
import { FileReadTool } from '../../src/tools/FileReadTool/FileReadTool.js'
import { FileWriteTool } from '../../src/tools/FileWriteTool/FileWriteTool.js'
import { GlobTool } from '../../src/tools/GlobTool/GlobTool.js'
import { GrepTool } from '../../src/tools/GrepTool/GrepTool.js'
import type { Tool } from '../../src/Tool.js'

// Core tools that must always be present in the open-source build
const CORE_TOOLS: Tool[] = [BashTool, FileReadTool, FileWriteTool, GlobTool, GrepTool]

describe('core tool structure', () => {
  it('core tools array is non-empty', () => {
    expect(CORE_TOOLS.length).toBeGreaterThan(0)
  })

  it('every tool has a non-empty name string', () => {
    for (const tool of CORE_TOOLS) {
      expect(typeof tool.name).toBe('string')
      expect(tool.name.length).toBeGreaterThan(0)
    }
  })

  it('every tool has a description', () => {
    for (const tool of CORE_TOOLS) {
      expect(tool.description).toBeDefined()
    }
  })

  it('every tool has an inputSchema (Zod schema object)', () => {
    for (const tool of CORE_TOOLS) {
      expect(tool.inputSchema).toBeDefined()
      expect(typeof tool.inputSchema).toBe('object')
      expect(tool.inputSchema).not.toBeNull()
    }
  })

  it('BashTool name is "Bash"', () => {
    expect(BashTool.name).toBe('Bash')
  })

  it('FileReadTool name is "Read"', () => {
    expect(FileReadTool.name).toBe('Read')
  })

  it('FileWriteTool name is "Write"', () => {
    expect(FileWriteTool.name).toBe('Write')
  })

  it('GlobTool name is "Glob"', () => {
    expect(GlobTool.name).toBe('Glob')
  })

  it('GrepTool name is "Grep"', () => {
    expect(GrepTool.name).toBe('Grep')
  })
})
