#!/bin/sh
set -e

# ── Validate required env vars ────────────────────────────────
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "ERROR: ANTHROPIC_API_KEY is not set." >&2
  echo "" >&2
  echo "  docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-ant-... claude-web" >&2
  echo "" >&2
  echo "  Or via docker-compose with a .env file:" >&2
  echo "    ANTHROPIC_API_KEY=sk-ant-... docker-compose up" >&2
  exit 1
fi

# ── Data directory setup (all-in-one image) ───────────────────
# When CLAUDE_DATA_DIR is set (e.g. /data from the volume mount),
# ensure the required sub-directories exist and wire up the home
# symlink so the claude CLI finds its config in the volume.
if [ -n "${CLAUDE_DATA_DIR:-}" ]; then
  mkdir -p "${CLAUDE_DATA_DIR}/.claude" "${CLAUDE_DATA_DIR}/users"

  # Link ~/.claude → $CLAUDE_DATA_DIR/.claude so the CLI writes to the volume
  if [ ! -e /home/claude/.claude ]; then
    ln -sf "${CLAUDE_DATA_DIR}/.claude" /home/claude/.claude
  fi
fi

# The API key is forwarded to child PTY processes via process.env,
# so the claude CLI will pick it up automatically — no config file needed.

echo "Claude Web Terminal starting on port ${PORT:-3000}..."
if [ -n "${AUTH_PROVIDER:-}" ] && [ "${AUTH_PROVIDER}" != "token" ]; then
  echo "  Auth provider: ${AUTH_PROVIDER}"
elif [ -n "${AUTH_TOKEN:-}" ]; then
  echo "  Auth token protection: enabled"
fi
if [ -n "${ALLOWED_ORIGINS:-}" ]; then
  echo "  Allowed origins: $ALLOWED_ORIGINS"
fi
echo "  Max sessions: ${MAX_SESSIONS:-10}"
if [ -n "${CLAUDE_DATA_DIR:-}" ]; then
  echo "  Data directory: ${CLAUDE_DATA_DIR}"
fi

# Hand off to the PTY WebSocket server
exec bun /app/src/server/web/pty-server.ts
