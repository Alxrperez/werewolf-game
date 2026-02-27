#!/usr/bin/env bash
set -euo pipefail
ROOT="$(dirname "$0")/.."
[ -f "$ROOT/TASKS.md" ] || cat > "$ROOT/TASKS.md" <<'MD'
# TASKS
## Now (WIP limit: 3)
- [ ]
## Next
- [ ]
## Later
- [ ]
MD

echo "TASKS.md ready at $ROOT/TASKS.md"
