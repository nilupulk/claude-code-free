export const MODELS = [
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", description: "Most capable" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", description: "Balanced" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", description: "Fastest" },
] as const;

export const DEFAULT_MODEL = "claude-sonnet-4-6";

export const API_ROUTES = {
  chat: "/api/chat",
  stream: "/api/stream",
} as const;

export const MAX_MESSAGE_LENGTH = 100_000;

export const STREAMING_CHUNK_SIZE = 64;
