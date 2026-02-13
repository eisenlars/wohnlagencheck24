#!/usr/bin/env bash
set -euo pipefail

# Restart Next.js dev server (preview mode)
# This script kills an existing "next dev" process and starts a new one.

# Defaults for preview mode (override via env)
TEXTGEN_PREVIEW="${TEXTGEN_PREVIEW:-1}"
TEXTGEN_PREVIEW_ALL="${TEXTGEN_PREVIEW_ALL:-1}"
TEXTGEN_PREVIEW_KEY="${TEXTGEN_PREVIEW_KEY:-immobilienmarkt_beschreibung_01}"

export TEXTGEN_PREVIEW
export TEXTGEN_PREVIEW_ALL
export TEXTGEN_PREVIEW_KEY

echo "Stopping existing next dev processes (if any)..."
pkill -f "next dev" || true
pkill -f "node .*next" || true

sleep 1

echo "Starting dev server with:"
echo "  TEXTGEN_PREVIEW=${TEXTGEN_PREVIEW}"
echo "  TEXTGEN_PREVIEW_ALL=${TEXTGEN_PREVIEW_ALL}"
echo "  TEXTGEN_PREVIEW_KEY=${TEXTGEN_PREVIEW_KEY}"

npm run dev
