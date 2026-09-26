#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

# 1. Загрузка переменных окружения из .env
if [ -f "$DIR/.env" ]; then
    set -a
    source "$DIR/.env"
    set +a
else
    echo "❌ ОШИБКА: Файл .env не найден в $DIR/.env!"
    echo "Создайте файл .env (например: cp .env.example .env) и укажите переменные без дефолтных значений:"
    echo "  BACKEND_PORT=..."
    echo "  FRONTEND_PORT=..."
    echo "  DATABASE_URL=..."
    exit 1
fi

# 2. Проверка обязательных переменных (без дефолтных значений)
if [ -z "$BACKEND_PORT" ]; then
    echo "❌ ОШИБКА: Переменная BACKEND_PORT не задана в .env!"
    exit 1
fi

if [ -z "$FRONTEND_PORT" ]; then
    echo "❌ ОШИБКА: Переменная FRONTEND_PORT не задана в .env!"
    exit 1
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ ОШИБКА: Переменная DATABASE_URL не задана в .env!"
    exit 1
fi

mkdir -p "$DIR/logs"

echo "========================================================="
echo " Запуск системы «Помощник диспетчера Билайн Бизнес»"
echo " Backend:  :$BACKEND_PORT"
echo " Frontend: :$FRONTEND_PORT"
echo " Database: $DATABASE_URL"
echo "========================================================="

# Остановка ранее запущенных процессов
"$DIR/scripts/stop_local.sh" 2>/dev/null || true

# 1. Запуск Backend Service (со встроенным алгоритмом оптимизации VRPTW и XAI)
echo "-> [1/2] Запуск Backend API на порту $BACKEND_PORT..."
BACKEND_DIR="$DIR/backend"
PYTHON_BIN="$DIR/.venv/bin/python"
if [ ! -f "$PYTHON_BIN" ]; then
    PYTHON_BIN="$DIR/venv/bin/python"
fi
if [ ! -f "$PYTHON_BIN" ]; then
    PYTHON_BIN="python3"
fi
if ! "$PYTHON_BIN" -c 'import fastapi, pydantic_settings, sqlalchemy, numpy, ortools, uvicorn' >/dev/null 2>&1; then
    echo "❌ В $PYTHON_BIN не установлены зависимости бэкенда. Запустите ./.venv/bin/pip install -e '.[dev]'"
    exit 1
fi

PYTHONPATH="$DIR:$BACKEND_DIR" BACKEND_PORT="$BACKEND_PORT" DATABASE_URL="$DATABASE_URL" setsid "$PYTHON_BIN" -m uvicorn main:app --app-dir "$BACKEND_DIR" --host 0.0.0.0 --port "$BACKEND_PORT" > "$DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!

# 2. Запуск Frontend
echo "-> [2/2] Запуск Frontend (React/Vite) на порту $FRONTEND_PORT..."
cd "$DIR/frontend"
FRONTEND_PORT="$FRONTEND_PORT" VITE_PROXY_TARGET="http://127.0.0.1:$BACKEND_PORT" setsid npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" > "$DIR/logs/frontend.log" 2>&1 &
FRONT_PID=$!
cd "$DIR"

echo "$BACKEND_PID $FRONT_PID" > "$DIR/.pids"

# Дожидаемся ответа обоих сервисов, а не только запуска процессов.
READY=0
for _ in {1..15}; do
    if curl -fsS "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null 2>&1 \
        && curl -fsS "http://127.0.0.1:$FRONTEND_PORT/" >/dev/null 2>&1 \
        && curl -fsS "http://127.0.0.1:$FRONTEND_PORT/api/v1/health" >/dev/null 2>&1; then
        READY=1
        break
    fi
    sleep 1
done
if [ "$READY" -ne 1 ]; then
    echo "❌ Backend или Frontend не ответил. Проверьте logs/backend.log и logs/frontend.log"
    "$DIR/scripts/stop_local.sh"
    exit 1
fi

echo ""
echo "========================================================="
echo " Сервисы успешно запущены в фоновом режиме!"
echo "---------------------------------------------------------"
echo " 🌐 Frontend (Дашборд):  http://localhost:$FRONTEND_PORT"
echo " ⚙️ Backend API Swagger: http://localhost:$BACKEND_PORT/docs"
echo "---------------------------------------------------------"
echo " Для остановки сервисов выполните: ./scripts/stop_local.sh"
echo " Логи работы доступны в папке:     ./logs/"
echo "========================================================="
