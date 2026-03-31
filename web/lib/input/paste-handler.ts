/**
 * Clipboard paste processing.
 *
 * Handles:
 * - Plain-text extraction from rich-text paste (strips HTML/RTF)
 * - Multi-line paste detection (insert as-is — do NOT auto-submit)
 * - Image paste: extract data-URL for attachment flow
 * - Bracketed paste mode markers (for terminal emulator compatibility)
 * - File paste: detect files in clipboard for attachment flow
 */

// ── Result types ──────────────────────────────────────────────────────────────

export type PasteResult =
  | { type: 'text'; text: string; isMultiLine: boolean }
  | { type: 'image'; dataUrl: string; mimeType: string }
  | { type: 'file'; name: string; dataUrl: string; mimeType: string }

// ── Bracketed paste ───────────────────────────────────────────────────────────

/**
 * Wrap pasted text in bracketed paste markers, matching what terminals send.
 * \x1b[200~ … \x1b[201~
 * Used when forwarding paste events to a running terminal process.
 */
export function bracketedPaste(text: string): string {
  return `\x1b[200~${text}\x1b[201~`
}

// ── Main paste processor ──────────────────────────────────────────────────────

/**
 * Process a ClipboardEvent and extract the most useful data.
 *
 * Priority order:
 * 1. Image in clipboard items
 * 2. Non-image file in clipboard items
 * 3. Plain text (stripping any HTML/RTF formatting)
 *
 * Returns null if the clipboard is empty or inaccessible.
 */
export async function processPaste(e: ClipboardEvent): Promise<PasteResult | null> {
  if (!e.clipboardData) return null

  // ── 1. Check clipboard items for files/images ─────────────────────────────
  const items = Array.from(e.clipboardData.items)

  for (const item of items) {
    if (item.kind !== 'file') continue

    const blob = item.getAsFile()
    if (!blob) continue

    const mimeType = blob.type || item.type
    const dataUrl = await blobToDataUrl(blob)

    if (mimeType.startsWith('image/')) {
      return { type: 'image', dataUrl, mimeType }
    }

    const name = (blob as File).name ?? 'attachment'
    return { type: 'file', name, dataUrl, mimeType }
  }

  // ── 2. Plain text ─────────────────────────────────────────────────────────
  // Prefer text/plain over text/html — this strips all formatting.
  const text = e.clipboardData.getData('text/plain')
  if (!text) return null

  return {
    type: 'text',
    text,
    isMultiLine: text.includes('\n'),
  }
}

// ── Textarea insertion ────────────────────────────────────────────────────────

/**
 * Insert `text` into a textarea at the current selection, replacing any
 * selected range. Returns the new value and cursor position.
 *
 * Does NOT mutate the textarea directly — callers apply the returned values
 * so React state stays in sync.
 */
export function insertText(
  el: HTMLTextAreaElement,
  text: string,
): { newValue: string; newCursorPos: number } {
  const { value, selectionStart, selectionEnd } = el
  const start = selectionStart ?? value.length
  const end = selectionEnd ?? value.length

  const newValue = value.slice(0, start) + text + value.slice(end)
  const newCursorPos = start + text.length

  return { newValue, newCursorPos }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}
