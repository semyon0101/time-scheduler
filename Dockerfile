FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml README.md ./
COPY backend/ ./backend/
COPY data/ ./data/

RUN pip install --no-cache-dir .

ENV PYTHONPATH=/app

EXPOSE ${BACKEND_PORT}

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${BACKEND_PORT}"]
