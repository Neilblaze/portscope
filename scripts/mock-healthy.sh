#!/usr/bin/env bash

PORT=${1:-3010}
echo "🟢 Starting a HEALTHY server on port $PORT..."
echo "This process remains attached to your terminal."
echo "Press Ctrl+C to gracefully stop it."

# Runs in foreground, PPID = current terminal
nc -lk "$PORT"
