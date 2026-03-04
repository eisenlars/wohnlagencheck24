#!/usr/bin/env bash
set -euo pipefail

# Vercel Ignored Build Step helper
# Exit 1 => build should run
# Exit 0 => skip build

if [[ -z "${VERCEL_GIT_COMMIT_REF:-}" ]]; then
  echo "No VERCEL_GIT_COMMIT_REF set -> run build"
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git not available -> run build"
  exit 1
fi

# Fetch latest state of current branch for diff base.
git fetch --depth=50 origin "${VERCEL_GIT_COMMIT_REF}" >/dev/null 2>&1 || true

BASE_REF="origin/${VERCEL_GIT_COMMIT_REF}"
if ! git rev-parse --verify "${BASE_REF}" >/dev/null 2>&1; then
  echo "No base ref ${BASE_REF} -> run build"
  exit 1
fi

CHANGED_FILES="$(git diff --name-only "${BASE_REF}"...HEAD || true)"

if [[ -z "${CHANGED_FILES}" ]]; then
  echo "No diff detected -> skip build"
  exit 0
fi

# Files/paths that require a real deployment build.
if echo "${CHANGED_FILES}" | grep -E -q \
  '^(app/|components/|features/|lib/|utils/|public/|content/|data/|next\.config\.(js|ts)$|package\.json$|package-lock\.json$|tsconfig\.json$|postcss\.config\.mjs$|eslint\.config\.mjs$|proxy\.ts$)'; then
  echo "Relevant app changes detected -> run build"
  exit 1
fi

echo "Only non-runtime changes detected -> skip build"
exit 0

