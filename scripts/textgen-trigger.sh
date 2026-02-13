#!/usr/bin/env bash
set -euo pipefail

# Defaults (override via env or args)
TOKEN="${TOKEN:-butterling_14713}"
BUNDESLAND="${BUNDESLAND:-sachsen}"
KREIS="${KREIS:-leipzig}"
ORTSLAGE="${ORTSLAGE:-}"
BASE_URL="${BASE_URL:-http://localhost:3000}"

# Args: --token --bundesland --kreis --ortslage --base-url
while [[ $# -gt 0 ]]; do
  case "$1" in
    --token) TOKEN="$2"; shift 2 ;;
    --bundesland) BUNDESLAND="$2"; shift 2 ;;
    --kreis) KREIS="$2"; shift 2 ;;
    --ortslage) ORTSLAGE="$2"; shift 2 ;;
    --base-url) BASE_URL="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

QUERY="token=${TOKEN}&bundesland=${BUNDESLAND}&kreis=${KREIS}"
if [[ -n "${ORTSLAGE}" ]]; then
  QUERY="${QUERY}&ortslage=${ORTSLAGE}"
fi

URL="${BASE_URL}/api/local-site-report?${QUERY}"
echo "Request: ${URL}"
curl -sS -i "${URL}"
