#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

mkdir -p "$DIR/logs"

echo "========================================================="
echo " Запуск системы «Помощник диспетчера Билайн Бизнес»"
echo "========================================================="

# Stop any previously running instances
"$DIR/stop_local.sh" 2>/dev/null || true

# 1. Start Algorithm Service (:8001)
echo "-> [1/3] Запуск Algorithm Engine на порту 8001..."
ALGORITHM_DIR="$DIR/algorithm"
PYTHONPATH="$ALGORITHM_DIR" setsid "$DIR/venv/bin/python" -m uvicorn app.main:app --app-dir "$ALGORITHM_DIR" --host 0.0.0.0 --port 8001 > "$DIR/logs/algorithm.log" 2>&1 &
ALGO_PID=$!

# 2. Start Backend Service (:8000)
echo "-> [2/3] Запуск Backend API на порту 8000..."
BACKEND_DIR="$DIR/backend"
PYTHONPATH="$BACKEND_DIR" ALGORITHM_SERVICE_URL="http://127.0.0.1:8001" setsid "$DIR/venv/bin/python" -m uvicorn app.main:app --app-dir "$BACKEND_DIR" --host 0.0.0.0 --port 8000 > "$DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!

# 3. Start Frontend (:3000)
echo "-> [3/3] Запуск Frontend (React/Vite) на порту 3000..."
cd "$DIR/frontend"
setsid npm run dev -- --host 0.0.0.0 --port 3000 > "$DIR/logs/frontend.log" 2>&1 &
FRONT_PID=$!
cd "$DIR"

echo "$ALGO_PID $BACKEND_PID $FRONT_PID" > "$DIR/.pids"

# Give services 2 seconds to initialize
sleep 2

echo ""
echo "========================================================="
echo " Все 3 сервиса успешно запущены в фоновом режиме!"
echo "---------------------------------------------------------"
echo " 🌐 Frontend (Дашборд):        http://localhost:3000"
echo " ⚙️ Backend API Swagger:       http://localhost:8000/docs"
echo " 🧮 Algorithm Service Swagger: http://localhost:8001/docs"
echo "---------------------------------------------------------"
echo " Для остановки сервисов выполните: ./stop_local.sh"
echo " Логи работы доступны в папке:     ./logs/"
echo "========================================================="
