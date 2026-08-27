#!/bin/bash
# Arranca backend (:3001), frontend (:3000) y el microservicio OCR (:8000) en local.
# Si un servicio ya está corriendo (otro worktree, otra terminal) no lo relanza.
set -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PIDS=()

cleanup() {
  echo ""
  echo "Deteniendo servicios arrancados por este script..."
  for pid in ${PIDS[@]:-}; do
    kill "$pid" 2>/dev/null
  done
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

port_in_use() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

start_service() {
  local name="$1" port="$2" dir="$3" cmd="$4"
  if port_in_use "$port"; then
    echo "[$name] ya está corriendo en :$port — no lo relanzo"
    return
  fi
  echo "[$name] arrancando en :$port..."
  ( cd "$dir" && eval "$cmd" ) 2>&1 | sed -u "s/^/[$name] /" &
  PIDS+=($!)
}

# 1. Postgres: servicio local (brew/system), este script no lo gestiona
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "Postgres no responde en localhost:5432."
  echo "Arráncalo antes de continuar (brew services start postgresql@<version>, o tu gestor habitual)."
  exit 1
fi
echo "[postgres] OK (localhost:5432)"

# 2. Dependencias JS (bun) si faltan
if [ ! -d backend/node_modules ]; then
  echo "[setup] instalando dependencias de backend..."
  (cd backend && bun install) || exit 1
fi
if [ ! -d frontend/node_modules ]; then
  echo "[setup] instalando dependencias de frontend..."
  (cd frontend && bun install) || exit 1
fi

# 3. backend/.env si falta, con la DATABASE_URL local por defecto
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  sed -i '' 's#^DATABASE_URL=.*#DATABASE_URL="postgresql://chefchek:chefchek_password_change_in_prod@localhost:5432/chefchek?schema=public"#' backend/.env
  echo "[setup] backend/.env creado — revisa JWT_SECRET y demás valores si tu entorno difiere"
fi

# 4. Arrancar los tres servicios (OCR usa su propio start.sh, que valida su venv/.env)
start_service "backend"  3001 "$ROOT_DIR/backend"                  "bun run start:dev"
start_service "frontend" 3000 "$ROOT_DIR/frontend"                 "bun run dev"
start_service "ocr"      8000 "$ROOT_DIR/backend/ocr-microservice" "./start.sh"

echo ""
echo "Frontend:  http://localhost:3000"
echo "Backend:   http://localhost:3001"
echo "OCR:       http://localhost:8000/health"
echo ""
echo "Ctrl+C para detener todo."
wait
