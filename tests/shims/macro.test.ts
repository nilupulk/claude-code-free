import { describe, it, expect } from 'vitest'
import MACRO from '../../src/shims/macro.js'

describe('MACRO', () => {
  it('VERSION is a non-empty string', () => {
    expect(typeof MACRO.VERSION).toBe('string')
    expect(MACRO.VERSION.length).toBeGreaterThan(0)
  })

  it('PACKAGE_URL is set to the npm package identifier', () => {
    expect(MACRO.PACKAGE_URL).toBe('@anthropic-ai/claude-code')
  })

  it('ISSUES_EXPLAINER is set and references the GitHub issues URL', () => {
    expect(typeof MACRO.ISSUES_EXPLAINER).toBe('string')
    expect(MACRO.ISSUES_EXPLAINER.length).toBeGreaterThan(0)
    expect(MACRO.ISSUES_EXPLAINER).toContain('github.com/anthropics/claude-code')
  })

  it('globalThis.MACRO matches the exported object', () => {
    expect((globalThis as any).MACRO).toBe(MACRO)
  })
})
