#!/usr/bin/env bash
set -euo pipefail
ROOT="$(dirname "$0")/.."
OUT="$ROOT/PROJECT_UPDATE.md"
DATE="$(date '+%Y-%m-%d %H:%M %Z')"
cat > "$OUT" <<MD
# Project Update

Generated: $DATE

## What changed
- 

## Done
- 

## Next 3 actions
1. 
2. 
3. 

## Blockers
- 

## Resources used
- CPU: 
- Memory: 
- Disk: 
- Runtime notes: 
MD

echo "Generated $OUT"
