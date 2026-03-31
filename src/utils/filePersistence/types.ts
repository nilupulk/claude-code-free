// Stub for src/utils/filePersistence/types.ts
// These constants represent sensible defaults for the file persistence feature.

export const DEFAULT_UPLOAD_CONCURRENCY = 5
export const FILE_COUNT_LIMIT = 1000
export const OUTPUTS_SUBDIR = 'outputs'

// Type stubs — used only at compile time, safe to be empty at runtime
export type FailedPersistence = { path: string; error: string }
export type FilesPersistedEventData = Record<string, unknown>
export type PersistedFile = { path: string; fileId: string }
export type TurnStartTime = number
