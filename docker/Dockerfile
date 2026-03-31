# ─────────────────────────────────────────────────────────────
# Claude Web Terminal — Production Container
# ─────────────────────────────────────────────────────────────
# Multi-stage build: compiles node-pty native module and bundles
# the Claude CLI, then copies artifacts into a slim runtime image.
#
# Usage:
#   docker build -f docker/Dockerfile -t claude-web .
#   docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-ant-... claude-web
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────
FROM oven/bun:1 AS builder

WORKDIR /app

# Build tools required to compile node-pty's native C++ addon
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests first for layer caching
COPY package.json bun.lockb* ./

# Install all deps (triggers node-pty native compilation)
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# Copy source tree
COPY . .

# Bundle the Claude CLI (produces dist/cli.mjs)
RUN bun run build:prod

# ── Stage 2: Runtime ──────────────────────────────────────────
FROM oven/bun:1 AS runtime

WORKDIR /app

# curl for health checks; no build tools needed at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user that PTY sessions will run under
RUN groupadd -r claude && useradd -r -g claude -m -d /home/claude claude

# Compiled node_modules (includes native node-pty binary)
COPY --from=builder /app/node_modules ./node_modules

# Bundled Claude CLI
COPY --from=builder /app/dist ./dist

# PTY server source (bun runs TypeScript natively)
COPY --from=builder /app/src/server ./src/server

# TypeScript config needed for bun's module resolution
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Thin wrapper so the PTY server can exec `claude` as a subprocess
RUN printf '#!/bin/sh\nexec bun /app/dist/cli.mjs "$@"\n' \
    > /usr/local/bin/claude && chmod +x /usr/local/bin/claude

# Entrypoint script
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Allow the claude user to write its config into its home dir
RUN chown -R claude:claude /home/claude

# ── Defaults ──────────────────────────────────────────────────
ENV NODE_ENV=production \
    PORT=3000 \
    MAX_SESSIONS=5 \
    CLAUDE_BIN=claude

EXPOSE 3000

USER claude

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
