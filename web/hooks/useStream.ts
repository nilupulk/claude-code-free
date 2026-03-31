"use client";

import { useCallback, useEffect, useRef } from "react";
import { SSEConnection } from "@/lib/api/stream";
import type { SSEConnectionOptions } from "@/lib/api/stream";
import type { StreamEvent } from "@/lib/api/types";
import { ApiError } from "@/lib/api/types";

export interface UseStreamOptions {
  /** Whether the connection should be active. Defaults to true. */
  enabled?: boolean;
  maxReconnects?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface UseStreamReturn {
  connect: () => void;
  disconnect: () => void;
}

/**
 * Low-level hook that manages a long-lived SSE connection.
 *
 * The connection is established when `enabled` is true (default) and the URL
 * is non-null. It is torn down automatically on unmount or when `enabled`
 * becomes false.
 *
 * @example
 * const { disconnect } = useStream("/sse", {
 *   onEvent: (e) => console.log(e),
 *   onError: (e) => console.error(e),
 * });
 */
export function useStream(
  url: string | null,
  opts: UseStreamOptions & {
    onEvent: (event: StreamEvent) => void;
    onError: (error: ApiError) => void;
  }
): UseStreamReturn {
  const connRef = useRef<SSEConnection | null>(null);

  // Keep callbacks in a ref so the connect/disconnect memos don't re-create
  // on every render when the caller passes inline arrow functions.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const disconnect = useCallback(() => {
    connRef.current?.disconnect();
    connRef.current = null;
  }, []);

  const connect = useCallback(() => {
    if (!url) return;
    disconnect();

    const connOpts: SSEConnectionOptions = {
      onEvent: (e) => optsRef.current.onEvent(e),
      onError: (e) => optsRef.current.onError(e),
      onConnect: () => optsRef.current.onConnect?.(),
      onDisconnect: () => optsRef.current.onDisconnect?.(),
      maxReconnects: optsRef.current.maxReconnects,
    };

    const conn = new SSEConnection(url, connOpts);
    conn.connect();
    connRef.current = conn;
  }, [url, disconnect]);

  useEffect(() => {
    if (opts.enabled === false || !url) {
      disconnect();
      return;
    }
    connect();
    return disconnect;
  }, [url, opts.enabled, connect, disconnect]);

  return { connect, disconnect };
}
