#!/usr/bin/env bash

START_PORT=${1:-3030}
COUNT=${2:-3}

echo "🚀 Starting $COUNT multiple listeners starting from port $START_PORT..."

for ((i=0; i<COUNT; i++)); do
  PORT=$((START_PORT + i))
  # Run in background
  nc -lk "$PORT" >/dev/null 2>&1 &
  PID=$!
  echo "✅ Started listener on port $PORT (PID $PID)"
done

echo ""
echo "All $COUNT mock servers are running in the background."
echo "Run 'portscope kill $START_PORT-$((START_PORT + COUNT - 1))' to clean them up."
