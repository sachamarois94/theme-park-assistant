#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/.logs/cron"
INGEST_SCRIPT="${PROJECT_ROOT}/scripts/jobs/ingest-wait-history.sh"
REFRESH_SCRIPT="${PROJECT_ROOT}/scripts/jobs/refresh-wait-baselines.sh"
CRON_MARKER_BEGIN="# THEME_PARK_ASSISTANT_BEGIN"
CRON_MARKER_END="# THEME_PARK_ASSISTANT_END"

mkdir -p "${LOG_DIR}"

if [[ ! -x "${INGEST_SCRIPT}" || ! -x "${REFRESH_SCRIPT}" ]]; then
  echo "FAIL: job scripts are not executable."
  exit 1
fi

NPM_BIN="$(command -v npm || true)"
if [[ -z "${NPM_BIN}" ]]; then
  echo "FAIL: npm not found in current PATH."
  exit 1
fi

CURRENT_CRONTAB="$(crontab -l 2>/dev/null || true)"
FILTERED_CRONTAB="$(printf "%s\n" "${CURRENT_CRONTAB}" | sed "/${CRON_MARKER_BEGIN}/,/${CRON_MARKER_END}/d")"

TMP_FILE="$(mktemp)"
{
  printf "%s\n" "${FILTERED_CRONTAB}"
  printf "%s\n" "${CRON_MARKER_BEGIN}"
  printf "%s\n" "*/5 * * * * NPM_BIN=\"${NPM_BIN}\" /bin/bash \"${INGEST_SCRIPT}\" >> \"${LOG_DIR}/ingest.log\" 2>&1"
  printf "%s\n" "*/15 * * * * NPM_BIN=\"${NPM_BIN}\" /bin/bash \"${REFRESH_SCRIPT}\" >> \"${LOG_DIR}/refresh.log\" 2>&1"
  printf "%s\n" "${CRON_MARKER_END}"
} > "${TMP_FILE}"

crontab "${TMP_FILE}"
rm -f "${TMP_FILE}"

echo "PASS: installed cron jobs"
echo "- Ingest every 5 minutes -> ${LOG_DIR}/ingest.log"
echo "- Refresh every 15 minutes -> ${LOG_DIR}/refresh.log"
echo ""
echo "Current managed entries:"
crontab -l | sed -n "/${CRON_MARKER_BEGIN}/,/${CRON_MARKER_END}/p"
