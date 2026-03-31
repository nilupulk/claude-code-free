/**
 * Circular byte buffer for PTY scrollback replay.
 * Stores the last `capacity` bytes of PTY output; oldest bytes are silently
 * discarded when the buffer is full.
 */
export class ScrollbackBuffer {
  private buf: Buffer;
  private writePos = 0; // next write position in the ring
  private stored = 0; // bytes currently stored (≤ capacity)
  readonly capacity: number;

  constructor(capacityBytes = 100 * 1024) {
    this.capacity = capacityBytes;
    this.buf = Buffer.allocUnsafe(capacityBytes);
  }

  /**
   * Append PTY output to the buffer.
   * Uses 'binary' (latin1) encoding to preserve raw byte values from node-pty.
   */
  write(data: string): void {
    const src = Buffer.from(data, "binary");
    const len = src.length;
    if (len === 0) return;

    if (len >= this.capacity) {
      // Incoming chunk larger than the whole buffer — keep only the tail
      src.copy(this.buf, 0, len - this.capacity);
      this.writePos = 0;
      this.stored = this.capacity;
      return;
    }

    const end = this.writePos + len;
    if (end <= this.capacity) {
      src.copy(this.buf, this.writePos);
    } else {
      // Wrap around the ring boundary
      const tailLen = this.capacity - this.writePos;
      src.copy(this.buf, this.writePos, 0, tailLen);
      src.copy(this.buf, 0, tailLen);
    }
    this.writePos = end % this.capacity;
    this.stored = Math.min(this.stored + len, this.capacity);
  }

  /**
   * Returns all buffered bytes in chronological order (oldest first).
   * The returned Buffer is a copy and safe to send over a WebSocket.
   */
  read(): Buffer {
    if (this.stored === 0) return Buffer.alloc(0);

    if (this.stored < this.capacity) {
      // Buffer hasn't wrapped yet — contiguous region starting at index 0
      return Buffer.from(this.buf.subarray(0, this.stored));
    }

    // Buffer is full and has wrapped — oldest data starts at writePos
    const out = Buffer.allocUnsafe(this.capacity);
    const tailLen = this.capacity - this.writePos;
    this.buf.copy(out, 0, this.writePos); // tail (oldest)
    this.buf.copy(out, tailLen, 0, this.writePos); // head (newest)
    return out;
  }
}
