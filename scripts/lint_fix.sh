#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../build-a-werewolf"
if npm run | grep -q "lint"; then
  npm run lint || true
fi
