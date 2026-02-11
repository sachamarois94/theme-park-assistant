#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env.local"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "FAIL: DATABASE_URL is required (missing in .env.local or environment)."
  exit 1
fi

if [[ -z "${BASE_URL:-}" ]]; then
  export BASE_URL="http://127.0.0.1:3000"
fi

if [[ -z "${NODE_OPTIONS:-}" ]]; then
  export NODE_OPTIONS="--dns-result-order=ipv4first"
fi

if [[ -z "${NPM_BIN:-}" ]]; then
  NPM_BIN="$(command -v npm || true)"
fi

if [[ -z "${NPM_BIN}" ]]; then
  echo "FAIL: npm executable not found. Set NPM_BIN or install Node/npm in cron PATH."
  exit 1
fi

cd "${PROJECT_ROOT}"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting wait-history ingest"
"${NPM_BIN}" run db:ingest:wait-history
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Ingest complete"
