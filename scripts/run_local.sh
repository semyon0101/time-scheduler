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
PYTHONPATH="$DIR:$BACKEND_DIR" BACKEND_PORT="$BACKEND_PORT" DATABASE_URL="$DATABASE_URL" setsid "$DIR/venv/bin/python" -m uvicorn main:app --app-dir "$BACKEND_DIR" --host 0.0.0.0 --port "$BACKEND_PORT" > "$DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!

# 2. Запуск Frontend
echo "-> [2/2] Запуск Frontend (React/Vite) на порту $FRONTEND_PORT..."
cd "$DIR/frontend"
FRONTEND_PORT="$FRONTEND_PORT" VITE_API_URL="http://localhost:$BACKEND_PORT/api" setsid npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" > "$DIR/logs/frontend.log" 2>&1 &
FRONT_PID=$!
cd "$DIR"

echo "$BACKEND_PID $FRONT_PID" > "$DIR/.pids"

# Даем сервисам 2 секунды на инициализацию
sleep 2

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
