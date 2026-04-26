#!/usr/bin/env bash

NAME=${1:-my_port}
PID_FILE="/tmp/${NAME}.pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  
  if ps -p "$PID" > /dev/null; then
    echo "Killing $NAME (PID $PID)..."
    kill "$PID"
    echo "Stopped $NAME successfully."
  else
    echo "Process $PID is not running anymore."
  fi
  
  rm "$PID_FILE"
else
  echo "Could not find PID file for '$NAME' at $PID_FILE"
  echo "Is the listener currently running?"
fi
