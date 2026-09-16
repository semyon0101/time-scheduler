#!/usr/bin/env bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

if [ -f .pids ]; then
  PIDS=$(cat .pids)
  echo "Остановка сервисов с PID: $PIDS..."
  for pid in $PIDS; do
    kill -9 $pid 2>/dev/null || true
    # Also kill process group if available
    kill -9 -$pid 2>/dev/null || true
  done
  rm -f .pids
fi

echo "Освобождение портов 8001, 8000, 3000 и завершение фоновых процессов..."
fuser -k -9 8001/tcp 2>/dev/null || true
fuser -k -9 8000/tcp 2>/dev/null || true
fuser -k -9 3000/tcp 2>/dev/null || true
pkill -9 -f "uvicorn.*app.main:app.*(8000|8001)" 2>/dev/null || true
pkill -9 -f "vite.*3000" 2>/dev/null || true

echo "Все сервисы успешно и гарантированно остановлены."
