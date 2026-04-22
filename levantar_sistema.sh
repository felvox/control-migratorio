#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
LOG_DIR="$ROOT_DIR/logs"
DOCKER_COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
BACKEND_ENV_FILE="$BACKEND_DIR/.env"
APP_URL="http://127.0.0.1:4200/login"

BACKEND_PID_FILE="$ROOT_DIR/.backend.pid"
FRONTEND_PID_FILE="$ROOT_DIR/.frontend.pid"

mkdir -p "$LOG_DIR"

if [[ ! -d "$BACKEND_DIR" || ! -d "$FRONTEND_DIR" ]]; then
  echo "No se encontraron carpetas backend/frontend en $ROOT_DIR"
  exit 1
fi

if [[ ! -f "$BACKEND_ENV_FILE" && -f "$BACKEND_DIR/.env.example" ]]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_ENV_FILE"
  echo "Se creó backend/.env desde .env.example"
fi

has_command() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1
}

require_command() {
  local cmd="$1"
  if ! has_command "$cmd"; then
    echo "Falta el comando requerido: $cmd"
    exit 1
  fi
}

get_compose_cmd() {
  if has_command docker && docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return
  fi

  if has_command docker-compose; then
    echo "docker-compose"
    return
  fi

  echo ""
}

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

    for _ in {1..10}; do
      if ! kill -0 "$pid" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done

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

ensure_node_modules() {
  local service_name="$1"
  local service_dir="$2"

  if [[ ! -d "$service_dir/node_modules" ]]; then
    echo "Instalando dependencias de $service_name..."
    (
      cd "$service_dir"
      npm install
    )
  fi
}

wait_for_database() {
  local compose_cmd="$1"

  echo "Esperando PostgreSQL..."
  for _ in {1..45}; do
    if $compose_cmd -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_isready -U postgres -d control_migratorio >/dev/null 2>&1; then
      echo "PostgreSQL disponible."
      return 0
    fi
    sleep 1
  done

  echo "PostgreSQL no respondió a tiempo."
  return 1
}

bootstrap_backend() {
  echo "Preparando backend (Prisma)..."
  (
    cd "$BACKEND_DIR"
    set -a
    source "$BACKEND_ENV_FILE"
    set +a
    npm run prisma:generate
    npm run prisma:deploy
    npm run prisma:seed
  )
}

start_service() {
  local name="$1"
  local pid_file="$2"
  local workdir="$3"
  local cmd="$4"
  local log_file="$5"

  echo "Levantando $name..."
  (
    cd "$workdir"
    nohup sh -c "$cmd" > "$log_file" 2>&1 &
    echo $! > "$pid_file"
  )

  local new_pid
  new_pid="$(cat "$pid_file")"
  sleep 2

  if ! kill -0 "$new_pid" >/dev/null 2>&1; then
    echo "Error: $name no pudo iniciar. Revisa $log_file"
    return 1
  fi

  echo "$name iniciado (PID $new_pid)"
}

wait_for_http() {
  local url="$1"
  local timeout_seconds="$2"

  for _ in $(seq 1 "$timeout_seconds"); do
    local status
    status="$(curl -sS -H 'Accept: text/html' -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || true)"

    if [[ "$status" =~ ^[0-9]{3}$ ]] && [[ "$status" -ge 200 ]] && [[ "$status" -lt 400 ]]; then
      return 0
    fi
    sleep 1
  done

  return 1
}

print_logs_hint() {
  echo "Revisa logs si algo no levanta:"
  echo "  tail -n 120 \"$LOG_DIR/backend.log\""
  echo "  tail -n 120 \"$LOG_DIR/frontend.log\""
}

open_browser() {
  if [[ "$(uname -s)" == "Darwin" ]]; then
    if has_command open; then
      if open -a "Google Chrome" "$APP_URL" >/dev/null 2>&1; then
        return 0
      fi
    fi

    if has_command osascript; then
      if osascript \
        -e "tell application \"Google Chrome\" to open location \"$APP_URL\"" \
        -e "tell application \"Google Chrome\" to activate" \
        >/dev/null 2>&1; then
        return 0
      fi
    fi

    echo "No se pudo abrir Google Chrome automáticamente. Abre manualmente: $APP_URL"
    return 1
  else
    echo "Abre manualmente: $APP_URL"
  fi
}

require_command npm
require_command curl
require_command lsof

# Limpieza previa para evitar usar procesos viejos o puertos ocupados.
stop_from_pid_file "backend" "$BACKEND_PID_FILE"
stop_from_pid_file "frontend" "$FRONTEND_PID_FILE"
stop_by_port "backend" 3000
stop_by_port "frontend" 4200

COMPOSE_CMD="$(get_compose_cmd)"

if [[ -n "$COMPOSE_CMD" ]]; then
  echo "Levantando base de datos..."
  if ! $COMPOSE_CMD -f "$DOCKER_COMPOSE_FILE" up -d postgres; then
    echo "Advertencia: no se pudo levantar PostgreSQL por docker compose."
  fi

  if ! wait_for_database "$COMPOSE_CMD"; then
    echo "Advertencia: PostgreSQL no quedó listo desde el script."
  fi
else
  echo "Advertencia: Docker Compose no disponible. Se continúa sin levantar PostgreSQL por script."
fi

ensure_node_modules "backend" "$BACKEND_DIR"
ensure_node_modules "frontend" "$FRONTEND_DIR"

if ! bootstrap_backend; then
  echo "Advertencia: Prisma bootstrap falló. Se intenta levantar igual backend/frontend."
fi

start_service "backend" "$BACKEND_PID_FILE" "$BACKEND_DIR" "npm run start:dev" "$LOG_DIR/backend.log"
start_service "frontend" "$FRONTEND_PID_FILE" "$FRONTEND_DIR" "npm start -- --host 127.0.0.1 --port 4200" "$LOG_DIR/frontend.log"

echo "Esperando frontend en $APP_URL ..."
if ! wait_for_http "$APP_URL" 90; then
  echo "No se detectó frontend en $APP_URL dentro del tiempo esperado."
  print_logs_hint
  exit 1
fi

open_browser

echo "Sistema levantado."
echo "URL: $APP_URL"
echo "Backend log:  $LOG_DIR/backend.log"
echo "Frontend log: $LOG_DIR/frontend.log"
