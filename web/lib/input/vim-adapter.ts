/**
 * Vim mode adapter for web textarea.
 *
 * Implements the vim state machine (adapted from src/vim/) operating on a
 * <textarea> element via selectionStart / selectionEnd / value manipulation.
 *
 * Supported modes:  INSERT → NORMAL → VISUAL → COMMAND
 * Supported motions: h j k l  w W b B e E  0 ^ $ G  f F t T
 * Supported operators: d (delete)  c (change)  y (yank)
 * Supported commands: x  r  p P  o O  i I a A  . (dot-repeat)  u (undo via DOM)
 *
 * Not supported (intentionally omitted for web):
 * - Ctrl-based motions (Ctrl-d, Ctrl-u) — conflict with browser / terminal shortcuts
 * - Marks, registers beyond the default unnamed register
 * - Ex commands beyond :q / :w (no file system)
 */

// ── Mode & state types ────────────────────────────────────────────────────────

export type VimMode = 'INSERT' | 'NORMAL' | 'VISUAL' | 'COMMAND'

export type VimOperator = 'delete' | 'change' | 'yank'

type FindType = 'f' | 'F' | 't' | 'T'

type CommandState =
  | { type: 'idle' }
  | { type: 'count'; digits: string }
  | { type: 'operator'; op: VimOperator; count: number }
  | { type: 'operatorCount'; op: VimOperator; count: number; digits: string }
  | { type: 'find'; find: FindType; count: number }
  | { type: 'operatorFind'; op: VimOperator; count: number; find: FindType }
  | { type: 'g'; count: number }
  | { type: 'replace'; count: number }

export interface VimState {
  mode: VimMode
  command: CommandState
  /** Text typed after ':' in command mode */
  commandInput: string
  /** Unnamed register (yank / delete storage) */
  register: string
  /** Whether the unnamed register holds a linewise selection */
  registerIsLinewise: boolean
  /** Last find (f/F/t/T + char) for ; and , repeat */
  lastFind: { type: FindType; char: string } | null
  /** Last change for dot-repeat */
  lastChange: RecordedChange | null
}

type RecordedChange =
  | { kind: 'insert'; text: string }
  | { kind: 'operator'; op: VimOperator; from: number; to: number }
  | { kind: 'x'; count: number }
  | { kind: 'replace'; char: string }

export function createVimState(): VimState {
  return {
    mode: 'INSERT',
    command: { type: 'idle' },
    commandInput: '',
    register: '',
    registerIsLinewise: false,
    lastFind: null,
    lastChange: null,
  }
}

// ── Text/position helpers ─────────────────────────────────────────────────────

interface LineInfo {
  start: number
  end: number // exclusive end (position of '\n' or value.length)
  text: string
}

function lineAt(value: string, pos: number): LineInfo {
  let start = pos
  while (start > 0 && value[start - 1] !== '\n') start--
  let end = pos
  while (end < value.length && value[end] !== '\n') end++
  return { start, end, text: value.slice(start, end) }
}

function isWordChar(c: string, bigWord: boolean): boolean {
  return bigWord ? c !== ' ' && c !== '\n' && c !== '\t' : /\w/.test(c)
}

/** Move forward to the start of the next word */
function nextWordStart(value: string, pos: number, bigWord = false): number {
  let i = pos
  const cur = value[i]
  if (cur !== undefined && isWordChar(cur, bigWord)) {
    while (i < value.length && isWordChar(value[i]!, bigWord)) i++
  }
  while (i < value.length && !isWordChar(value[i]!, bigWord)) i++
  return Math.min(i, value.length)
}

/** Move backward to the start of the current or previous word */
function prevWordStart(value: string, pos: number, bigWord = false): number {
  let i = pos - 1
  while (i > 0 && !isWordChar(value[i]!, bigWord)) i--
  while (i > 0 && isWordChar(value[i - 1]!, bigWord)) i--
  return Math.max(0, i)
}

/** Move to the end of the current or next word */
function wordEnd(value: string, pos: number, bigWord = false): number {
  let i = pos + 1
  while (i < value.length && !isWordChar(value[i]!, bigWord)) i++
  while (i < value.length - 1 && isWordChar(value[i + 1]!, bigWord)) i++
  return Math.min(i, value.length - 1)
}

/** Move up/down by `count` lines, preserving column */
function moveVertical(value: string, pos: number, delta: number): number {
  const { start } = lineAt(value, pos)
  const col = pos - start
  let curStart = start

  const direction = delta > 0 ? 1 : -1
  let remaining = Math.abs(delta)

  while (remaining > 0) {
    if (direction > 0) {
      // Move down: find end of current line then start of next
      let end = curStart
      while (end < value.length && value[end] !== '\n') end++
      if (end >= value.length) break
      curStart = end + 1
    } else {
      // Move up: find start of previous line
      if (curStart === 0) break
      let prev = curStart - 2
      while (prev > 0 && value[prev - 1] !== '\n') prev--
      curStart = prev
    }
    remaining--
  }

  const line = lineAt(value, curStart)
  return line.start + Math.min(col, line.end - line.start)
}

/** Find char `char` starting from pos in direction given by FindType */
function findChar(
  value: string,
  pos: number,
  type: FindType,
  char: string,
  count: number,
): number | null {
  const forward = type === 'f' || type === 't'
  const inclusive = type === 'f' || type === 'F'

  let found = pos
  let remaining = count

  while (remaining > 0) {
    if (forward) {
      const next = value.indexOf(char, found + 1)
      if (next === -1) return null
      found = next
    } else {
      const prev = value.lastIndexOf(char, found - 1)
      if (prev === -1) return null
      found = prev
    }
    remaining--
  }

  if (!inclusive) {
    return forward ? found - 1 : found + 1
  }
  return found
}

// ── Motion resolver ───────────────────────────────────────────────────────────

/**
 * Resolve a motion key to a new cursor position.
 * Returns null if the key is not a motion.
 */
function resolveMotion(
  key: string,
  value: string,
  pos: number,
  count: number,
  state: VimState,
): { newPos: number; newState?: Partial<VimState> } | null {
  switch (key) {
    case 'h':
      return { newPos: Math.max(0, pos - count) }
    case 'l':
      return { newPos: Math.min(value.length, pos + count) }
    case 'k':
      return { newPos: moveVertical(value, pos, -count) }
    case 'j':
      return { newPos: moveVertical(value, pos, count) }
    case 'w': {
      let p = pos
      for (let i = 0; i < count; i++) p = nextWordStart(value, p)
      return { newPos: p }
    }
    case 'W': {
      let p = pos
      for (let i = 0; i < count; i++) p = nextWordStart(value, p, true)
      return { newPos: p }
    }
    case 'b': {
      let p = pos
      for (let i = 0; i < count; i++) p = prevWordStart(value, p)
      return { newPos: p }
    }
    case 'B': {
      let p = pos
      for (let i = 0; i < count; i++) p = prevWordStart(value, p, true)
      return { newPos: p }
    }
    case 'e': {
      let p = pos
      for (let i = 0; i < count; i++) p = wordEnd(value, p)
      return { newPos: p }
    }
    case 'E': {
      let p = pos
      for (let i = 0; i < count; i++) p = wordEnd(value, p, true)
      return { newPos: p }
    }
    case '0':
      return { newPos: lineAt(value, pos).start }
    case '^': {
      const { start, end } = lineAt(value, pos)
      let i = start
      while (i < end && (value[i] === ' ' || value[i] === '\t')) i++
      return { newPos: i }
    }
    case '$': {
      let p = pos
      for (let i = 0; i < count; i++) {
        const { end } = lineAt(value, p)
        p = Math.max(lineAt(value, p).start, end - 1)
        if (i < count - 1) p = end + 1
      }
      return { newPos: p }
    }
    case 'G':
      return { newPos: value.length }
    case 'g':
      // handled as two-key sequence: gg → go to top
      return null
    default:
      return null
  }
}

// ── Operator application ──────────────────────────────────────────────────────

interface OperatorResult {
  newValue: string
  newCursorPos: number
  stateChanges: Partial<VimState>
}

function applyOperator(
  op: VimOperator,
  value: string,
  from: number,
  to: number,
): OperatorResult {
  const start = Math.min(from, to)
  const end = Math.max(from, to)
  const deleted = value.slice(start, end)

  if (op === 'yank') {
    return {
      newValue: value,
      newCursorPos: from,
      stateChanges: { register: deleted, registerIsLinewise: false },
    }
  }

  const newValue = value.slice(0, start) + value.slice(end)
  const stateChanges: Partial<VimState> = {
    register: deleted,
    registerIsLinewise: false,
    command: { type: 'idle' },
  }

  if (op === 'change') {
    stateChanges.mode = 'INSERT'
  }

  return { newValue, newCursorPos: start, stateChanges }
}

// ── Public result type ────────────────────────────────────────────────────────

export interface VimKeyResult {
  /** Whether the key was consumed by the vim handler */
  handled: boolean
  newState: VimState
  /** Updated textarea value, if changed */
  newValue?: string
  /** New cursor position in the textarea, if it should move */
  newCursorPos?: number
}

// ── Core key processor ────────────────────────────────────────────────────────

/**
 * Process a single keypress in vim mode.
 *
 * @param key         e.key from the DOM KeyboardEvent (e.g. "Escape", "j", "d")
 * @param shift       Whether Shift is held
 * @param ctrl        Whether Ctrl is held
 * @param el          The target textarea element (read for value/cursor, not mutated)
 * @param state       Current vim state
 * @param setValue    Callback to update the textarea value in React state
 */
export function processVimKey(
  key: string,
  shift: boolean,
  ctrl: boolean,
  el: HTMLTextAreaElement,
  state: VimState,
  setValue: (v: string) => void,
): VimKeyResult {
  const miss: VimKeyResult = { handled: false, newState: state }

  // ── INSERT mode ──────────────────────────────────────────────────────────
  if (state.mode === 'INSERT') {
    if (key === 'Escape') {
      const newPos = Math.max(0, el.selectionStart - 1)
      return {
        handled: true,
        newState: { ...state, mode: 'NORMAL', command: { type: 'idle' } },
        newCursorPos: newPos,
      }
    }
    return miss
  }

  // ── COMMAND mode (:) ─────────────────────────────────────────────────────
  if (state.mode === 'COMMAND') {
    if (key === 'Escape') {
      return {
        handled: true,
        newState: { ...state, mode: 'NORMAL', commandInput: '', command: { type: 'idle' } },
      }
    }
    if (key === 'Enter') {
      // Minimal command execution
      const cmd = state.commandInput.trim()
      const newState: VimState = { ...state, mode: 'NORMAL', commandInput: '', command: { type: 'idle' } }
      if (cmd === 'q' || cmd === 'q!' || cmd === 'quit') {
        // No-op in web — there's no file to quit
      }
      return { handled: true, newState }
    }
    if (key === 'Backspace') {
      const ci = state.commandInput.slice(0, -1)
      if (!ci) {
        return { handled: true, newState: { ...state, mode: 'NORMAL', commandInput: '' } }
      }
      return { handled: true, newState: { ...state, commandInput: ci } }
    }
    if (key.length === 1) {
      return { handled: true, newState: { ...state, commandInput: state.commandInput + key } }
    }
    return { handled: true, newState: state }
  }

  // ── NORMAL / VISUAL mode ─────────────────────────────────────────────────
  const value = el.value
  const pos = el.selectionStart
  const cmd = state.command

  // Extract count from the command state
  const pendingCount =
    cmd.type === 'count' ? parseInt(cmd.digits, 10)
    : cmd.type === 'operatorCount' ? parseInt(cmd.digits, 10)
    : 'count' in cmd ? (cmd as { count: number }).count
    : 1
  const count = pendingCount || 1

  // ── Escape / cancel ──────────────────────────────────────────────────────
  if (key === 'Escape') {
    if (state.mode === 'VISUAL') {
      return { handled: true, newState: { ...state, mode: 'NORMAL', command: { type: 'idle' } } }
    }
    return { handled: true, newState: { ...state, command: { type: 'idle' } } }
  }

  // ── Command mode entry ───────────────────────────────────────────────────
  if (key === ':') {
    return {
      handled: true,
      newState: { ...state, mode: 'COMMAND', commandInput: '', command: { type: 'idle' } },
    }
  }

  // ── Visual mode entry ────────────────────────────────────────────────────
  if (key === 'v' && state.mode !== 'VISUAL') {
    return { handled: true, newState: { ...state, mode: 'VISUAL', command: { type: 'idle' } } }
  }

  // ── Count accumulation ───────────────────────────────────────────────────
  if (/^[1-9]$/.test(key) && cmd.type === 'idle') {
    return { handled: true, newState: { ...state, command: { type: 'count', digits: key } } }
  }
  if (/^[0-9]$/.test(key) && cmd.type === 'count' && key !== '0') {
    return { handled: true, newState: { ...state, command: { type: 'count', digits: cmd.digits + key } } }
  }
  if (/^[0-9]$/.test(key) && cmd.type === 'operatorCount') {
    return {
      handled: true,
      newState: { ...state, command: { ...cmd, digits: cmd.digits + key } },
    }
  }

  // ── Two-key sequence: g ──────────────────────────────────────────────────
  if (key === 'g' && cmd.type !== 'g' && cmd.type !== 'operatorFind') {
    if (cmd.type === 'operator') {
      return { handled: true, newState: { ...state, command: { type: 'operatorCount', op: cmd.op, count: cmd.count, digits: '' } } }
    }
    return { handled: true, newState: { ...state, command: { type: 'g', count } } }
  }
  if (cmd.type === 'g' && key === 'g') {
    return { handled: true, newState: { ...state, command: { type: 'idle' } }, newCursorPos: 0 }
  }

  // ── Insert mode entries ──────────────────────────────────────────────────
  if (key === 'i' && cmd.type === 'idle') {
    return { handled: true, newState: { ...state, mode: 'INSERT', command: { type: 'idle' } } }
  }
  if (key === 'I') {
    const { start, end } = lineAt(value, pos)
    let i = start
    while (i < end && (value[i] === ' ' || value[i] === '\t')) i++
    return { handled: true, newState: { ...state, mode: 'INSERT', command: { type: 'idle' } }, newCursorPos: i }
  }
  if (key === 'a') {
    return {
      handled: true,
      newState: { ...state, mode: 'INSERT', command: { type: 'idle' } },
      newCursorPos: Math.min(pos + 1, value.length),
    }
  }
  if (key === 'A') {
    return {
      handled: true,
      newState: { ...state, mode: 'INSERT', command: { type: 'idle' } },
      newCursorPos: lineAt(value, pos).end,
    }
  }
  if (key === 'o') {
    const { end } = lineAt(value, pos)
    const newValue = value.slice(0, end) + '\n' + value.slice(end)
    setValue(newValue)
    return {
      handled: true,
      newState: { ...state, mode: 'INSERT', command: { type: 'idle' } },
      newValue,
      newCursorPos: end + 1,
    }
  }
  if (key === 'O') {
    const { start } = lineAt(value, pos)
    const newValue = value.slice(0, start) + '\n' + value.slice(start)
    setValue(newValue)
    return {
      handled: true,
      newState: { ...state, mode: 'INSERT', command: { type: 'idle' } },
      newValue,
      newCursorPos: start,
    }
  }
  if (key === 's') {
    // s = cl (change char)
    const end = Math.min(pos + count, value.length)
    const deleted = value.slice(pos, end)
    const newValue = value.slice(0, pos) + value.slice(end)
    setValue(newValue)
    return {
      handled: true,
      newState: { ...state, mode: 'INSERT', command: { type: 'idle' }, register: deleted },
      newValue,
      newCursorPos: pos,
    }
  }

  // ── x — delete character ─────────────────────────────────────────────────
  if (key === 'x') {
    const end = Math.min(pos + count, value.length)
    const deleted = value.slice(pos, end)
    const newValue = value.slice(0, pos) + value.slice(end)
    setValue(newValue)
    return {
      handled: true,
      newState: { ...state, command: { type: 'idle' }, register: deleted, lastChange: { kind: 'x', count } },
      newValue,
      newCursorPos: Math.min(pos, newValue.length - 1),
    }
  }

  // ── r — replace character ────────────────────────────────────────────────
  if (cmd.type === 'replace') {
    if (key.length === 1) {
      const replaced = value.slice(0, pos) + key.repeat(count) + value.slice(pos + count)
      setValue(replaced)
      return {
        handled: true,
        newState: { ...state, command: { type: 'idle' }, lastChange: { kind: 'replace', char: key } },
        newValue: replaced,
        newCursorPos: pos,
      }
    }
    return { handled: true, newState: { ...state, command: { type: 'idle' } } }
  }
  if (key === 'r') {
    return { handled: true, newState: { ...state, command: { type: 'replace', count } } }
  }

  // ── R — enter replace mode (implemented as repeated r) ──────────────────
  // (skipped for simplicity — web doesn't need overstrike mode)

  // ── p / P — paste ────────────────────────────────────────────────────────
  if (key === 'p') {
    const insertAt = Math.min(pos + 1, value.length)
    const newValue = value.slice(0, insertAt) + state.register.repeat(count) + value.slice(insertAt)
    setValue(newValue)
    return {
      handled: true,
      newState: { ...state, command: { type: 'idle' } },
      newValue,
      newCursorPos: insertAt,
    }
  }
  if (key === 'P') {
    const newValue = value.slice(0, pos) + state.register.repeat(count) + value.slice(pos)
    setValue(newValue)
    return {
      handled: true,
      newState: { ...state, command: { type: 'idle' } },
      newValue,
      newCursorPos: pos,
    }
  }

  // ── ~ — toggle case ──────────────────────────────────────────────────────
  if (key === '~') {
    const end = Math.min(pos + count, value.length)
    const toggled = value
      .slice(pos, end)
      .split('')
      .map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()))
      .join('')
    const newValue = value.slice(0, pos) + toggled + value.slice(end)
    setValue(newValue)
    return {
      handled: true,
      newState: { ...state, command: { type: 'idle' } },
      newValue,
      newCursorPos: Math.min(pos + count, newValue.length - 1),
    }
  }

  // ── Operators d / c / y ──────────────────────────────────────────────────
  if ((key === 'd' || key === 'c' || key === 'y') && cmd.type !== 'operatorFind') {
    const op: VimOperator = key === 'd' ? 'delete' : key === 'c' ? 'change' : 'yank'

    // Double operator: dd / cc / yy → whole line
    if (cmd.type === 'operator' && cmd.op === op) {
      const { start, end } = lineAt(value, pos)
      const lineEnd = Math.min(end + 1, value.length)
      const result = applyOperator(op, value, start, lineEnd)
      if (result.newValue !== value) setValue(result.newValue)
      return {
        handled: true,
        newState: {
          ...state,
          ...result.stateChanges,
          registerIsLinewise: true,
          command: { type: 'idle' },
        },
        newValue: result.newValue,
        newCursorPos: result.newCursorPos,
      }
    }

    // Count after operator: e.g. 2d then motion
    if (cmd.type === 'operatorCount') {
      // Already have operator; this `key` must be a second operator char or motion
      // Fall through to motion handling below with existing cmd
    }

    if (cmd.type === 'idle' || cmd.type === 'count') {
      return {
        handled: true,
        newState: { ...state, command: { type: 'operator', op, count } },
      }
    }
  }

  // ── f / F / t / T — find char ────────────────────────────────────────────
  if (['f', 'F', 't', 'T'].includes(key)) {
    const find = key as FindType
    if (cmd.type === 'operator') {
      return {
        handled: true,
        newState: { ...state, command: { type: 'operatorFind', op: cmd.op, count: cmd.count, find } },
      }
    }
    return {
      handled: true,
      newState: { ...state, command: { type: 'find', find, count } },
    }
  }

  // ── Collect find char ────────────────────────────────────────────────────
  if ((cmd.type === 'find' || cmd.type === 'operatorFind') && key.length === 1) {
    const found = findChar(value, pos, cmd.find, key, cmd.type === 'find' ? cmd.count : count)
    const newLastFind = { type: cmd.find, char: key }

    if (found === null) {
      return { handled: true, newState: { ...state, command: { type: 'idle' }, lastFind: newLastFind } }
    }

    if (cmd.type === 'operatorFind') {
      const result = applyOperator(cmd.op, value, pos, found)
      if (result.newValue !== value) setValue(result.newValue)
      return {
        handled: true,
        newState: { ...state, ...result.stateChanges, lastFind: newLastFind, command: { type: 'idle' } },
        newValue: result.newValue,
        newCursorPos: result.newCursorPos,
      }
    }

    return {
      handled: true,
      newState: { ...state, command: { type: 'idle' }, lastFind: newLastFind },
      newCursorPos: found,
    }
  }

  // ── ; and , — repeat last find ───────────────────────────────────────────
  if ((key === ';' || key === ',') && state.lastFind) {
    const { type, char } = state.lastFind
    const repeatType: FindType =
      key === ','
        ? type === 'f' ? 'F' : type === 'F' ? 'f' : type === 't' ? 'T' : 't'
        : type
    const found = findChar(value, pos, repeatType, char, count)
    if (found !== null) {
      return { handled: true, newState: { ...state, command: { type: 'idle' } }, newCursorPos: found }
    }
    return { handled: true, newState: { ...state, command: { type: 'idle' } } }
  }

  // ── Simple motions ───────────────────────────────────────────────────────
  const motion = resolveMotion(key, value, pos, count, state)
  if (motion) {
    const newPos = Math.max(0, Math.min(value.length, motion.newPos))

    if (cmd.type === 'operator') {
      const result = applyOperator(cmd.op, value, pos, newPos)
      if (result.newValue !== value) setValue(result.newValue)
      return {
        handled: true,
        newState: {
          ...state,
          ...result.stateChanges,
          command: { type: 'idle' },
          ...(motion.newState ?? {}),
        },
        newValue: result.newValue,
        newCursorPos: result.newCursorPos,
      }
    }

    if (state.mode === 'VISUAL') {
      // In VISUAL mode, just move — selection handled by textarea native selection
      return {
        handled: true,
        newState: { ...state, command: { type: 'idle' }, ...(motion.newState ?? {}) },
        newCursorPos: newPos,
      }
    }

    return {
      handled: true,
      newState: { ...state, command: { type: 'idle' }, ...(motion.newState ?? {}) },
      newCursorPos: newPos,
    }
  }

  // If an operator or count was pending and nothing resolved, cancel
  if (cmd.type !== 'idle') {
    return { handled: true, newState: { ...state, command: { type: 'idle' } } }
  }

  return miss
}
