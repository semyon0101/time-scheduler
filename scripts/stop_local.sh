#!/usr/bin/env bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

if [ -f "$DIR/.env" ]; then
    set -a
    source "$DIR/.env"
    set +a
fi

echo "Остановка сервисов..."

if [ -f "$DIR/.pids" ]; then
    read BACKEND_PID FRONT_PID < "$DIR/.pids"
    [ -n "$BACKEND_PID" ] && kill -9 "$BACKEND_PID" 2>/dev/null || true
    [ -n "$FRONT_PID" ] && kill -9 "$FRONT_PID" 2>/dev/null || true
    rm -f "$DIR/.pids"
fi

[ -n "$BACKEND_PORT" ] && fuser -k "${BACKEND_PORT}/tcp" 2>/dev/null || true
[ -n "$FRONTEND_PORT" ] && fuser -k "${FRONTEND_PORT}/tcp" 2>/dev/null || true

echo "Сервисы остановлены."
