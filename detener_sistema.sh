#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PID_FILE="$ROOT_DIR/.backend.pid"
FRONTEND_PID_FILE="$ROOT_DIR/.frontend.pid"

stop_from_pid_file() {
  local name="$1"
  local pid_file="$2"

  if [[ ! -f "$pid_file" ]]; then
    return
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"

  if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    echo "Deteniendo $name (PID $pid)..."
    kill "$pid" >/dev/null 2>&1 || true
    sleep 1
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
  fi

  rm -f "$pid_file"
}

stop_by_port() {
  local name="$1"
  local port="$2"
  local pids

  pids="$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    return
  fi

  echo "Liberando puerto $port ($name)..."
  echo "$pids" | xargs kill >/dev/null 2>&1 || true
  sleep 1

  local remaining
  remaining="$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$remaining" ]]; then
    echo "$remaining" | xargs kill -9 >/dev/null 2>&1 || true
  fi
}

stop_from_pid_file "backend" "$BACKEND_PID_FILE"
stop_from_pid_file "frontend" "$FRONTEND_PID_FILE"
stop_by_port "backend" 3000
stop_by_port "frontend" 4200

echo "Sistema detenido."
