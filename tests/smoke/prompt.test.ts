import { describe, it, expect } from 'vitest'
import { getSystemPrompt } from '../../src/constants/prompts.js'
import { BashTool } from '../../src/tools/BashTool/BashTool.js'
import { FileReadTool } from '../../src/tools/FileReadTool/FileReadTool.js'
import { FileWriteTool } from '../../src/tools/FileWriteTool/FileWriteTool.js'
import { GlobTool } from '../../src/tools/GlobTool/GlobTool.js'
import { GrepTool } from '../../src/tools/GrepTool/GrepTool.js'

const MODEL = 'claude-sonnet-4-6'
// A minimal set of tools — enough to exercise getSystemPrompt() without
// pulling in the full tool registry (which has lazy require()s for ant-only tools).
const TOOLS = [BashTool, FileReadTool, FileWriteTool, GlobTool, GrepTool]

describe('getSystemPrompt()', () => {
  it('returns an array', async () => {
    const prompt = await getSystemPrompt(TOOLS as any, MODEL)
    expect(Array.isArray(prompt)).toBe(true)
  })

  it('returns a non-empty array', async () => {
    const prompt = await getSystemPrompt(TOOLS as any, MODEL)
    expect(prompt.length).toBeGreaterThan(0)
  })

  it('every element is a non-empty string', async () => {
    const prompt = await getSystemPrompt(TOOLS as any, MODEL)
    for (const part of prompt) {
      expect(typeof part).toBe('string')
      expect(part.length).toBeGreaterThan(0)
    }
  })

  it('prompt text does not contain unresolved "undefined" MACRO references', async () => {
    const prompt = await getSystemPrompt(TOOLS as any, MODEL)
    const combined = prompt.join('\n')
    // MACRO.VERSION and similar should be resolved — "undefined" would indicate a missing global
    expect(combined).not.toMatch(/\bundefined\b.*version/i)
    expect(combined).not.toMatch(/version.*\bundefined\b/i)
  })

  it('prompt mentions Claude Code', async () => {
    const prompt = await getSystemPrompt(TOOLS as any, MODEL)
    const combined = prompt.join('\n')
    expect(combined.toLowerCase()).toContain('claude')
  })
})
