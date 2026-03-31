/**
 * Browser FileSystem shim.
 * All operations proxy to the Next.js API routes that execute on the server.
 * Matches the Node.js `fs/promises` + `fs` API surface used by this codebase.
 */

import type { FileSystem, Stats, Dirent } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function apiUrl(path: string): string {
  // Works in browser (relative) and in SSR (absolute via env var)
  const base =
    typeof window !== "undefined"
      ? ""
      : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000");
  return `${base}${path}`;
}

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(body.error ?? res.statusText), {
      code: res.status === 404 ? "ENOENT" : "EIO",
    });
  }
  return res;
}

// ---------------------------------------------------------------------------
// Stats factory — constructs a Stats-like object from the API response
// ---------------------------------------------------------------------------

function makeStats(raw: {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  mtime: string;
  ctime: string;
  mode: number;
}): Stats {
  return {
    size: raw.size,
    mtime: new Date(raw.mtime),
    ctime: new Date(raw.ctime),
    mode: raw.mode,
    isFile: () => raw.isFile,
    isDirectory: () => raw.isDirectory,
    isSymbolicLink: () => raw.isSymbolicLink,
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export const webFs: FileSystem = {
  // --- read ----------------------------------------------------------------

  async readFile(path: string, encoding?: string): Promise<string | Uint8Array> {
    const res = await apiFetch(
      apiUrl(`/api/fs/read?path=${encodeURIComponent(path)}`)
    );
    const data = await res.json();
    if (encoding === "utf-8" || encoding === "utf8") {
      return data.content as string;
    }
    // Binary: content is a base64 string
    const bin = atob(data.content);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  },

  // --- write ---------------------------------------------------------------

  async writeFile(path: string, content: string | Uint8Array): Promise<void> {
    const body =
      typeof content === "string"
        ? { path, content, encoding: "utf-8" }
        : { path, content: btoa(String.fromCharCode(...content)), encoding: "base64" };

    await apiFetch(apiUrl("/api/fs/write"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  },

  // --- append --------------------------------------------------------------

  async appendFile(path: string, data: string): Promise<void> {
    await apiFetch(apiUrl("/api/fs/append"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, data }),
    });
  },

  // --- readdir -------------------------------------------------------------

  async readdir(path: string): Promise<string[]> {
    const res = await apiFetch(
      apiUrl(`/api/fs/list?path=${encodeURIComponent(path)}`)
    );
    const data = await res.json();
    return (data.entries as Array<{ name: string }>).map((e) => e.name);
  },

  async readdirWithTypes(path: string): Promise<Dirent[]> {
    const res = await apiFetch(
      apiUrl(`/api/fs/list?path=${encodeURIComponent(path)}&withTypes=1`)
    );
    const data = await res.json();
    return (
      data.entries as Array<{
        name: string;
        isFile: boolean;
        isDirectory: boolean;
        isSymbolicLink: boolean;
      }>
    ).map((e) => ({
      name: e.name,
      isFile: () => e.isFile,
      isDirectory: () => e.isDirectory,
      isSymbolicLink: () => e.isSymbolicLink,
    }));
  },

  // --- stat / lstat --------------------------------------------------------

  async stat(path: string): Promise<Stats> {
    const res = await apiFetch(
      apiUrl(`/api/fs/stat?path=${encodeURIComponent(path)}`)
    );
    return makeStats(await res.json());
  },

  async lstat(path: string): Promise<Stats> {
    const res = await apiFetch(
      apiUrl(`/api/fs/stat?path=${encodeURIComponent(path)}&lstat=1`)
    );
    return makeStats(await res.json());
  },

  // --- exists --------------------------------------------------------------

  async exists(path: string): Promise<boolean> {
    const res = await apiFetch(
      apiUrl(`/api/fs/exists?path=${encodeURIComponent(path)}`)
    );
    const data = await res.json();
    return data.exists as boolean;
  },

  // --- mkdir ---------------------------------------------------------------

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await apiFetch(apiUrl("/api/fs/mkdir"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, recursive: options?.recursive ?? false }),
    });
  },

  // --- remove --------------------------------------------------------------

  async rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    await apiFetch(apiUrl("/api/fs/rm"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path,
        recursive: options?.recursive ?? false,
        force: options?.force ?? false,
      }),
    });
  },

  async unlink(path: string): Promise<void> {
    await apiFetch(apiUrl("/api/fs/rm"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, recursive: false, force: false }),
    });
  },

  // --- rename / copy -------------------------------------------------------

  async rename(from: string, to: string): Promise<void> {
    await apiFetch(apiUrl("/api/fs/rename"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to }),
    });
  },

  async copyFile(src: string, dest: string): Promise<void> {
    await apiFetch(apiUrl("/api/fs/copy"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ src, dest }),
    });
  },

  // --- symlink / realpath --------------------------------------------------

  async realpath(path: string): Promise<string> {
    const res = await apiFetch(
      apiUrl(`/api/fs/realpath?path=${encodeURIComponent(path)}`)
    );
    return (await res.json()).path as string;
  },

  async readlink(path: string): Promise<string> {
    const res = await apiFetch(
      apiUrl(`/api/fs/readlink?path=${encodeURIComponent(path)}`)
    );
    return (await res.json()).target as string;
  },

  async symlink(target: string, path: string): Promise<void> {
    await apiFetch(apiUrl("/api/fs/symlink"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, path }),
    });
  },

  // --- chmod ---------------------------------------------------------------

  async chmod(path: string, mode: number): Promise<void> {
    await apiFetch(apiUrl("/api/fs/chmod"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, mode }),
    });
  },

  // --- watch ---------------------------------------------------------------

  watch(
    path: string,
    _options: { recursive?: boolean },
    listener: (event: "rename" | "change", filename: string) => void
  ): { close(): void } {
    // Use SSE to watch for file changes via the backend.
    const url = apiUrl(`/api/fs/watch?path=${encodeURIComponent(path)}`);
    const es = new EventSource(url);
    es.addEventListener("change", (e) => {
      const { event, filename } = JSON.parse((e as MessageEvent).data);
      listener(event, filename);
    });
    return { close: () => es.close() };
  },
};
