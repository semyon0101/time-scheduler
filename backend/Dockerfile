FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY seed/ ./seed/
COPY app/ ./app/

ENV ALGORITHM_SERVICE_URL=http://algorithm:8001
ENV DATABASE_URL=sqlite:////app/data/scheduler.db

VOLUME /app/data

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
