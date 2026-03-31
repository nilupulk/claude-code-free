#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Claude Web Terminal — Backup Script
# ─────────────────────────────────────────────────────────────
# Creates a timestamped tar.gz archive of all persistent data.
#
# Usage:
#   ./scripts/backup.sh [--dest /path/to/backups] [--container claude-web]
#
# The backup contains:
#   - /data (or docker volume) — sessions, user configs, scrollback
#
# Examples:
#   # Docker Compose (mounts volume, backs up to ./backups/)
#   ./scripts/backup.sh
#
#   # Custom destination
#   ./scripts/backup.sh --dest /mnt/nas/claude-backups
#
#   # Custom container name
#   ./scripts/backup.sh --container my-claude-web --dest /backups
#
#   # Kubernetes (backs up PVC via a temp pod)
#   KUBE=1 ./scripts/backup.sh --namespace claude --dest /backups
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────
DEST="${BACKUP_DEST:-$(pwd)/backups}"
CONTAINER="${CONTAINER:-claude-web}"
NAMESPACE="${NAMESPACE:-default}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ARCHIVE_NAME="claude-backup-${TIMESTAMP}.tar.gz"
KUBE="${KUBE:-0}"

# ── Argument parsing ──────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dest)       DEST="$2";      shift 2 ;;
    --container)  CONTAINER="$2"; shift 2 ;;
    --namespace)  NAMESPACE="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

mkdir -p "$DEST"
ARCHIVE_PATH="${DEST}/${ARCHIVE_NAME}"

echo "Claude Web Terminal — Backup"
echo "  Destination : $ARCHIVE_PATH"
echo "  Timestamp   : $TIMESTAMP"
echo ""

# ── Kubernetes backup ─────────────────────────────────────────
if [[ "$KUBE" == "1" ]]; then
  echo "Mode: Kubernetes (PVC backup via temporary pod)"

  RELEASE="${HELM_RELEASE:-claude-code}"
  PVC_NAME="${RELEASE}"

  echo "  PVC         : ${PVC_NAME} (namespace: ${NAMESPACE})"
  echo "  Starting temporary backup pod..."

  # Run a one-shot pod that tars the PVC and streams the archive to stdout
  kubectl run "claude-backup-${TIMESTAMP}" \
    --namespace "$NAMESPACE" \
    --image=alpine:3 \
    --restart=Never \
    --overrides="{
      \"spec\": {
        \"volumes\": [{
          \"name\": \"data\",
          \"persistentVolumeClaim\": {\"claimName\": \"${PVC_NAME}\"}
        }],
        \"containers\": [{
          \"name\": \"backup\",
          \"image\": \"alpine:3\",
          \"command\": [\"tar\", \"czf\", \"-\", \"-C\", \"/\", \"data\"],
          \"volumeMounts\": [{
            \"name\": \"data\",
            \"mountPath\": \"/data\"
          }]
        }]
      }
    }" \
    --wait \
    --quiet 2>/dev/null || true

  kubectl wait pod "claude-backup-${TIMESTAMP}" \
    --namespace "$NAMESPACE" \
    --for=condition=Ready \
    --timeout=60s

  kubectl logs "claude-backup-${TIMESTAMP}" \
    --namespace "$NAMESPACE" \
    --follow=false \
    > "$ARCHIVE_PATH"

  kubectl delete pod "claude-backup-${TIMESTAMP}" \
    --namespace "$NAMESPACE" \
    --ignore-not-found=true \
    --wait=false

  echo "Backup complete: $ARCHIVE_PATH ($(du -sh "$ARCHIVE_PATH" | cut -f1))"
  exit 0
fi

# ── Docker backup ─────────────────────────────────────────────
echo "Mode: Docker"

# Check if the container is running
if ! docker inspect "$CONTAINER" &>/dev/null; then
  echo "ERROR: Container '${CONTAINER}' not found." >&2
  echo "  Is the service running? Try: docker compose ps" >&2
  exit 1
fi

echo "  Container   : $CONTAINER"

# Stream a tar archive of /data out of the running container
# Uses docker exec so the container doesn't need to be stopped.
docker exec "$CONTAINER" \
  tar czf - -C / data \
  > "$ARCHIVE_PATH"

# Verify the archive is non-empty
BYTES=$(wc -c < "$ARCHIVE_PATH")
if [[ "$BYTES" -lt 100 ]]; then
  echo "ERROR: Archive appears empty (${BYTES} bytes). Backup may have failed." >&2
  rm -f "$ARCHIVE_PATH"
  exit 1
fi

echo "Backup complete: $ARCHIVE_PATH ($(du -sh "$ARCHIVE_PATH" | cut -f1))"

# ── Retention: keep last 30 backups ──────────────────────────
echo "Cleaning up old backups (keeping last 30)..."
ls -t "${DEST}"/claude-backup-*.tar.gz 2>/dev/null | tail -n +31 | xargs -r rm --
echo "Done."
