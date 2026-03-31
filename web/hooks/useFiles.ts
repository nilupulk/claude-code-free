"use client";

import useSWR from "swr";
import { fileAPI } from "@/lib/api/files";
import type { FileEntry, SearchResult } from "@/lib/api/types";

// ---------------------------------------------------------------------------
// useFiles — SWR-based directory listing
// ---------------------------------------------------------------------------

export interface UseFilesReturn {
  files: FileEntry[];
  isLoading: boolean;
  error: Error | null;
  /** Manually re-fetch the listing. */
  refresh: () => Promise<void>;
}

/**
 * Fetches and caches a directory listing from the MCP file server.
 * Pass `null` to disable fetching (e.g. when no path is selected yet).
 *
 * @example
 * const { files, isLoading } = useFiles("src/components");
 */
export function useFiles(path: string | null): UseFilesReturn {
  const { data, error, isLoading, mutate } = useSWR<FileEntry[]>(
    path ? ["files:list", path] : null,
    ([, p]: [string, string]) => fileAPI.list(p),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5_000,
    }
  );

  return {
    files: data ?? [],
    isLoading,
    error: error as Error | null,
    refresh: async () => {
      await mutate();
    },
  };
}

// ---------------------------------------------------------------------------
// useFileContent — SWR-based file content reader
// ---------------------------------------------------------------------------

export interface UseFileContentReturn {
  content: string | null;
  isLoading: boolean;
  error: Error | null;
}

export interface UseFileContentOptions {
  offset?: number;
  limit?: number;
}

/**
 * Fetches the text content of a file from the MCP server.
 *
 * @example
 * const { content } = useFileContent("src/index.ts");
 */
export function useFileContent(
  path: string | null,
  opts?: UseFileContentOptions
): UseFileContentReturn {
  const { data, error, isLoading } = useSWR<string>(
    path ? ["files:read", path, opts?.offset, opts?.limit] : null,
    ([, p, offset, limit]: [string, string, number | undefined, number | undefined]) =>
      fileAPI.read(p, { offset: offset ?? undefined, limit: limit ?? undefined }),
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  );

  return {
    content: data ?? null,
    isLoading,
    error: error as Error | null,
  };
}

// ---------------------------------------------------------------------------
// useFileSearch — debounced full-text search
// ---------------------------------------------------------------------------

export interface UseFileSearchReturn {
  results: SearchResult[];
  isLoading: boolean;
  error: Error | null;
}

export interface UseFileSearchOptions {
  /** Glob pattern to restrict the search (e.g. "**\/*.ts") */
  glob?: string;
  /** Disable fetching while the query is still being typed. */
  enabled?: boolean;
}

/**
 * Searches source files via the MCP `search_source` tool.
 * Pass `null` as the query to disable searching.
 *
 * @example
 * const { results } = useFileSearch("useState", { glob: "**\/*.tsx" });
 */
export function useFileSearch(
  query: string | null,
  opts?: UseFileSearchOptions
): UseFileSearchReturn {
  const enabled = opts?.enabled !== false;

  const { data, error, isLoading } = useSWR<SearchResult[]>(
    query && enabled ? ["files:search", query, opts?.glob] : null,
    ([, q, glob]: [string, string, string | undefined]) =>
      fileAPI.search(q, glob ? { glob } : undefined),
    {
      revalidateOnFocus: false,
      dedupingInterval: 500,
      keepPreviousData: true,
    }
  );

  return {
    results: data ?? [],
    isLoading,
    error: error as Error | null,
  };
}
