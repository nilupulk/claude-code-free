import { describe, it, expect } from 'vitest'
import { getCommands } from '../../src/commands.js'

const CWD = process.cwd()

describe('getCommands()', () => {
  it('returns an array', async () => {
    const commands = await getCommands(CWD)
    expect(Array.isArray(commands)).toBe(true)
  })

  it('returns a non-empty list', async () => {
    const commands = await getCommands(CWD)
    expect(commands.length).toBeGreaterThan(0)
  })

  it('every command has a name string', async () => {
    const commands = await getCommands(CWD)
    for (const cmd of commands) {
      expect(typeof cmd.name).toBe('string')
      expect(cmd.name.length).toBeGreaterThan(0)
    }
  })

  it('every command has a description string', async () => {
    const commands = await getCommands(CWD)
    for (const cmd of commands) {
      expect(typeof cmd.description).toBe('string')
    }
  })

  it('/help command is present', async () => {
    const commands = await getCommands(CWD)
    expect(commands.some(c => c.name === 'help')).toBe(true)
  })

  it('/config command is present', async () => {
    const commands = await getCommands(CWD)
    expect(commands.some(c => c.name === 'config')).toBe(true)
  })
})
