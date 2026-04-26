#!/usr/bin/env bash

PORT=${1:-3000}
NAME=${2:-my_port}
FOREGROUND=${3:-false}

echo "Starting $NAME on port $PORT..."

if [ "$FOREGROUND" = "true" ]; then
  echo "Running in foreground. Press Ctrl+C to stop."
  nc -lk "$PORT" 
  exit 0
fi

nc -lk "$PORT" >/dev/null 2>&1 &
PID=$!

echo "$PID" > "/tmp/${NAME}.pid"

echo "Started $NAME on port $PORT with PID $PID"
echo "Verify by running: lsof -i :$PORT"
