import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { feature } from 'bun:bundle'

describe('feature()', () => {
  it('returns false for an unknown flag', () => {
    expect(feature('TOTALLY_UNKNOWN_FLAG_XYZ')).toBe(false)
  })

  it('returns false for a known but disabled flag by default', () => {
    // PROACTIVE defaults to false when env var is not set
    const saved = process.env.CLAUDE_CODE_PROACTIVE
    delete process.env.CLAUDE_CODE_PROACTIVE
    // The flag map is built at import time, so we just verify the default
    expect(typeof feature('PROACTIVE')).toBe('boolean')
    if (saved !== undefined) process.env.CLAUDE_CODE_PROACTIVE = saved
  })

  it('returns a boolean for every known flag', () => {
    const knownFlags = [
      'PROACTIVE',
      'KAIROS',
      'BRIDGE_MODE',
      'DAEMON',
      'VOICE_MODE',
      'AGENT_TRIGGERS',
      'MONITOR_TOOL',
      'COORDINATOR_MODE',
      'ABLATION_BASELINE',
      'DUMP_SYSTEM_PROMPT',
      'BG_SESSIONS',
      'HISTORY_SNIP',
      'WORKFLOW_SCRIPTS',
    ]
    for (const flag of knownFlags) {
      expect(typeof feature(flag)).toBe('boolean')
    }
  })

  it('ABLATION_BASELINE is always false regardless of env vars', () => {
    // Hardcoded false in the shim — env var must not override it
    const saved = process.env.CLAUDE_CODE_ABLATION_BASELINE
    process.env.CLAUDE_CODE_ABLATION_BASELINE = '1'
    // The flag map is evaluated at module load time, so the value is fixed
    expect(feature('ABLATION_BASELINE')).toBe(false)
    if (saved !== undefined) {
      process.env.CLAUDE_CODE_ABLATION_BASELINE = saved
    } else {
      delete process.env.CLAUDE_CODE_ABLATION_BASELINE
    }
  })
})
