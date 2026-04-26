#!/usr/bin/env bash

PORT=${1:-3040}
echo "⏸️  Starting a PAUSED server on port $PORT..."

# Start listener in background
nc -lk "$PORT" >/dev/null 2>&1 &
PID=$!

# Give it a fraction of a second to bind the port
sleep 0.5 

# Send SIGSTOP to freeze the process
kill -STOP "$PID"

echo "✅ Process $PID started and immediately SUSPENDED (SIGSTOP)."
echo "It holds the port but consumes exactly 0.0% CPU."
echo "Use 'portscope resume $PORT' to wake it up."
