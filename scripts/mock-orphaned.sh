#!/usr/bin/env bash

PORT=${1:-3020}
echo "👻 Starting an ORPHANED server on port $PORT..."

# Spawning in a subshell and detaching completely
# This forces the parent PID (PPID) to become 1 (init/launchd)
( nc -lk "$PORT" >/dev/null 2>&1 & )

echo "✅ Detached successfully. PortScope will now detect this as 'orphaned'."
