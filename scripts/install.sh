#!/usr/bin/env sh
# ─────────────────────────────────────────────────────────────
# Claude Web Terminal — One-Line Installer
# ─────────────────────────────────────────────────────────────
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/anthropics/claude-code/main/scripts/install.sh | sh
#
# Or with an API key:
#   curl -fsSL .../install.sh | ANTHROPIC_API_KEY=sk-ant-... sh
#
# What it does:
#   1. Checks for Docker / Docker Compose
#   2. Downloads docker-compose.yml and required config files
#   3. Prompts for ANTHROPIC_API_KEY if not set
#   4. Starts the service
# ─────────────────────────────────────────────────────────────
set -e

REPO="https://raw.githubusercontent.com/anthropics/claude-code/main"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.claude-web}"
PORT="${PORT:-3000}"

# ── Colours ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { printf "${BLUE}  →${NC} %s\n" "$*"; }
success() { printf "${GREEN}  ✓${NC} %s\n" "$*"; }
warn()    { printf "${YELLOW}  !${NC} %s\n" "$*"; }
error()   { printf "${RED}  ✗${NC} %s\n" "$*" >&2; exit 1; }

echo ""
echo "  Claude Web Terminal Installer"
echo "  ─────────────────────────────"
echo ""

# ── Dependency checks ─────────────────────────────────────────
info "Checking dependencies..."

if ! command -v docker >/dev/null 2>&1; then
  error "Docker is not installed. Install it from https://docs.docker.com/get-docker/"
fi
success "Docker found: $(docker --version | head -1)"

# Support both 'docker compose' (v2) and 'docker-compose' (v1)
COMPOSE_CMD=""
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  error "Docker Compose not found. Install it from https://docs.docker.com/compose/install/"
fi
success "Compose found: $($COMPOSE_CMD version | head -1)"

# ── API key ───────────────────────────────────────────────────
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo ""
  printf "  Enter your Anthropic API key (from console.anthropic.com): "
  # shellcheck disable=SC2034
  read -r ANTHROPIC_API_KEY
  echo ""
  if [ -z "$ANTHROPIC_API_KEY" ]; then
    error "ANTHROPIC_API_KEY is required."
  fi
fi

# ── Install directory ─────────────────────────────────────────
info "Installing to $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

# ── Download files ────────────────────────────────────────────
info "Downloading configuration files..."

download() {
  src="$1"
  dst="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$src" -o "$dst"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$dst" "$src"
  else
    error "Neither curl nor wget found. Install one and retry."
  fi
}

download "${REPO}/docker/docker-compose.yml"       "${INSTALL_DIR}/docker-compose.yml"
download "${REPO}/docker/Dockerfile.all-in-one"    "${INSTALL_DIR}/Dockerfile"
download "${REPO}/docker/entrypoint.sh"            "${INSTALL_DIR}/entrypoint.sh"
chmod +x "${INSTALL_DIR}/entrypoint.sh"

success "Files downloaded."

# ── Write .env ────────────────────────────────────────────────
ENV_FILE="${INSTALL_DIR}/.env"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<EOF
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
PORT=${PORT}
# AUTH_TOKEN=change-me         # Uncomment to password-protect the UI
# MAX_SESSIONS=10
# MAX_SESSIONS_PER_USER=3
EOF
  success "Created $ENV_FILE"
else
  warn ".env already exists — not overwriting. Update ANTHROPIC_API_KEY manually if needed."
fi

# ── Start ─────────────────────────────────────────────────────
echo ""
info "Starting Claude Web Terminal..."
cd "$INSTALL_DIR"

# Rebuild the image if this is a fresh install (Dockerfile was just downloaded)
$COMPOSE_CMD up -d --build

echo ""
success "Claude Web Terminal is running!"
echo ""
echo "  Open your browser: http://localhost:${PORT}"
echo ""
echo "  Useful commands (run from ${INSTALL_DIR}):"
echo "    $COMPOSE_CMD logs -f          # View logs"
echo "    $COMPOSE_CMD down             # Stop the service"
echo "    $COMPOSE_CMD pull && $COMPOSE_CMD up -d  # Update to latest"
echo ""
echo "  Data is stored in a Docker volume and persists across restarts."
echo "  Backup: ./scripts/backup.sh"
echo ""
