#!/usr/bin/env bash
set -euo pipefail

CRON_MARKER_BEGIN="# THEME_PARK_ASSISTANT_BEGIN"
CRON_MARKER_END="# THEME_PARK_ASSISTANT_END"

CURRENT_CRONTAB="$(crontab -l 2>/dev/null || true)"
FILTERED_CRONTAB="$(printf "%s\n" "${CURRENT_CRONTAB}" | sed "/${CRON_MARKER_BEGIN}/,/${CRON_MARKER_END}/d")"

TMP_FILE="$(mktemp)"
printf "%s\n" "${FILTERED_CRONTAB}" > "${TMP_FILE}"
crontab "${TMP_FILE}"
rm -f "${TMP_FILE}"

echo "PASS: removed Theme Park Assistant managed cron entries"
