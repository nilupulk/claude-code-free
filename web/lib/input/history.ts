/**
 * Input history — up/down arrow navigation through past entries.
 *
 * Mirrors the terminal's history behaviour:
 * - Up arrow → navigate to older entries
 * - Down arrow → navigate to newer entries, back to current draft
 * - Entering a new message appends to history and resets the cursor
 */

export interface InputHistory {
  /**
   * Push a new entry. No-ops on empty strings and consecutive duplicates.
   * Also resets the navigation cursor.
   */
  push(entry: string): void

  /**
   * Move the cursor back (toward older entries).
   * Pass the current input text so it can be saved as a draft for when the
   * user navigates forward again.
   * Returns the entry to display, or null if already at the oldest entry.
   */
  back(currentDraft: string): string | null

  /**
   * Move the cursor forward (toward newer entries / current draft).
   * Returns the newer entry, or the saved draft if the cursor reaches the end.
   */
  forward(): string | null

  /**
   * Reset the navigation cursor without adding a history entry.
   * Call this when the user clears the input or starts a fresh session.
   */
  resetCursor(): void

  /** All stored entries, oldest-first. Read-only view. */
  readonly entries: readonly string[]

  /** True when the cursor is positioned somewhere inside history (not at draft) */
  readonly isBrowsing: boolean
}

/**
 * Create an in-memory input history instance.
 *
 * @param maxSize Maximum number of entries to keep (oldest are pruned). Default 500.
 */
export function createInputHistory(maxSize = 500): InputHistory {
  let entries: string[] = []

  // Index into `entries` of the currently displayed item.
  // -1 means "showing the live draft" (not browsing history).
  let cursor = -1

  // Draft saved when the user starts navigating so we can restore it on forward.
  let savedDraft = ''

  function resetCursor() {
    cursor = -1
    savedDraft = ''
  }

  return {
    get entries(): readonly string[] {
      return entries
    },

    get isBrowsing(): boolean {
      return cursor !== -1
    },

    push(entry: string) {
      const trimmed = entry.trim()
      if (!trimmed) return
      // Avoid consecutive duplicates
      if (entries.length > 0 && entries[entries.length - 1] === trimmed) {
        resetCursor()
        return
      }
      entries.push(trimmed)
      if (entries.length > maxSize) {
        entries = entries.slice(entries.length - maxSize)
      }
      resetCursor()
    },

    back(currentDraft: string): string | null {
      if (entries.length === 0) return null
      if (cursor === -1) {
        // First navigation: save current input as draft
        savedDraft = currentDraft
        cursor = entries.length - 1
      } else if (cursor > 0) {
        cursor--
      }
      // cursor === 0: already at oldest, return same entry (no movement)
      return entries[cursor] ?? null
    },

    forward(): string | null {
      if (cursor === -1) return null
      cursor++
      if (cursor >= entries.length) {
        // Past the end → restore draft
        resetCursor()
        return savedDraft
      }
      return entries[cursor] ?? null
    },

    resetCursor,
  }
}
