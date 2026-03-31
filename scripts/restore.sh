#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Claude Web Terminal — Restore Script
# ─────────────────────────────────────────────────────────────
# Restores a backup produced by backup.sh into a running container
# or Kubernetes PVC.
#
# Usage:
#   ./scripts/restore.sh <backup-file.tar.gz> [options]
#
# Options:
#   --container <name>    Docker container name (default: claude-web)
#   --namespace <ns>      Kubernetes namespace (default: default)
#   --yes                 Skip confirmation prompt
#
# Examples:
#   # Docker Compose
#   ./scripts/restore.sh backups/claude-backup-20240101_120000.tar.gz
#
#   # Kubernetes
#   KUBE=1 ./scripts/restore.sh backups/claude-backup-20240101_120000.tar.gz \
#     --namespace claude
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ── Argument parsing ──────────────────────────────────────────
BACKUP_FILE=""
CONTAINER="${CONTAINER:-claude-web}"
NAMESPACE="${NAMESPACE:-default}"
KUBE="${KUBE:-0}"
YES="${YES:-0}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --container)  CONTAINER="$2"; shift 2 ;;
    --namespace)  NAMESPACE="$2"; shift 2 ;;
    --yes|-y)     YES=1;          shift ;;
    -*)           echo "Unknown option: $1" >&2; exit 1 ;;
    *)            BACKUP_FILE="$1"; shift ;;
  esac
done

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <backup-file.tar.gz> [--container NAME] [--yes]" >&2
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

echo "Claude Web Terminal — Restore"
echo "  Backup file : $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"
echo ""
echo "  WARNING: This will OVERWRITE all current data in the container."
echo ""

if [[ "$YES" != "1" ]]; then
  read -r -p "  Continue? [y/N] " confirm
  case "$confirm" in
    [yY][eE][sS]|[yY]) ;;
    *) echo "Aborted."; exit 0 ;;
  esac
fi

# ── Kubernetes restore ────────────────────────────────────────
if [[ "$KUBE" == "1" ]]; then
  echo ""
  echo "Mode: Kubernetes"
  RELEASE="${HELM_RELEASE:-claude-code}"
  PVC_NAME="${RELEASE}"

  echo "  PVC         : ${PVC_NAME} (namespace: ${NAMESPACE})"
  echo "  Starting temporary restore pod..."

  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
  POD_NAME="claude-restore-${TIMESTAMP}"

  # Create the pod
  kubectl run "$POD_NAME" \
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
          \"name\": \"restore\",
          \"image\": \"alpine:3\",
          \"command\": [\"sh\", \"-c\", \"tar xzf /tmp/backup.tar.gz -C / && echo RESTORE_DONE\"],
          \"volumeMounts\": [{
            \"name\": \"data\",
            \"mountPath\": \"/data\"
          }]
        }]
      }
    }" \
    --quiet 2>/dev/null || true

  kubectl wait pod "$POD_NAME" \
    --namespace "$NAMESPACE" \
    --for=condition=Ready \
    --timeout=60s

  # Copy the backup into the pod then trigger extraction
  kubectl cp "$BACKUP_FILE" "${NAMESPACE}/${POD_NAME}:/tmp/backup.tar.gz"

  # Wait for extraction to complete
  kubectl exec "$POD_NAME" --namespace "$NAMESPACE" \
    -- sh -c "tar xzf /tmp/backup.tar.gz -C / && echo RESTORE_DONE"

  kubectl delete pod "$POD_NAME" \
    --namespace "$NAMESPACE" \
    --ignore-not-found=true \
    --wait=false

  echo ""
  echo "Restore complete. Restart the deployment to pick up the restored data:"
  echo "  kubectl rollout restart deployment/${RELEASE} -n ${NAMESPACE}"
  exit 0
fi

# ── Docker restore ────────────────────────────────────────────
echo ""
echo "Mode: Docker"

if ! docker inspect "$CONTAINER" &>/dev/null; then
  echo "ERROR: Container '${CONTAINER}' not found." >&2
  echo "  Is the service running? Try: docker compose ps" >&2
  exit 1
fi

echo "  Container   : $CONTAINER"
echo "  Extracting backup..."

# Stream the archive into the container and extract
docker exec -i "$CONTAINER" \
  tar xzf - -C / \
  < "$BACKUP_FILE"

echo ""
echo "Restore complete."
echo "The container will use the restored data immediately (no restart needed)."
echo "If sessions look stale, restart the service:"
echo "  docker compose restart"
