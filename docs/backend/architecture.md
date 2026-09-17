# Слоистая архитектура Backend (Layered Architecture)

## 1. Обзор архитектуры

Бэкенд спроектирован по канонической слоистой архитектуре (Layered Architecture). Алгоритмический модуль оптимизации расписаний (VRPTW) и объяснимого ИИ (XAI) встроен непосредственно в состав бэкенда (`backend/Algorithm/`), исключая необходимость в отдельном сетевом микросервисе и порте. В качестве основной СУБД используется **PostgreSQL**.

```
       ┌────────────────────────────────────────┐
       │     FastAPI App (backend/main.py)      │
       └───────────────────┬────────────────────┘
                           │
       ┌───────────────────▼────────────────────┐
       │   Controllers (backend/Controllers/)   │ <─── HTTP / JSON (:BACKEND_PORT)
       └───────────────────┬────────────────────┘
                           │
       ┌───────────────────▼────────────────────┐
       │      Services (backend/Services/)      │ <─── Бизнес-логика & Оркестрация
       └──────┬──────────────────────────┬──────┘
              │                          │
              ▼                          ▼
   ┌──────────────────────┐   ┌──────────────────────┐
   │      Repository      │   │   In-process VRPTW   │ <─── Встроенный оптимизатор
   │(backend/Repository/) │   │ (backend/Algorithm/) │      и генератор XAI
   └──────────┬───────────┘   └──────────────────────┘
              │
              ▼
   ┌──────────────────────┐
   │       Entities       │
   │ (backend/Entities/)  │ <─── SQLAlchemy ORM & PostgreSQL (psycopg2)
   └──────────────────────┘
```

---

## 2. Слои приложения

### 2.1. Controllers (`backend/Controllers/v1/`)
- Принимают HTTP-запросы, валидируют входящие данные через Pydantic-схемы (`backend/Models/`).
- Версионированы в пакете `backend/Controllers/v1/` с единым агрегатором роутов `backend/Controllers/router.py` (доступны по префиксам `/api/v1` и обратно совместимому `/api`, а также корневой `/health`).
- Внедряют сервисы через `Annotated[SomeService, Depends(get_some_service)]` из `backend.Dependencies`.
- **Не содержат** бизнес-логики и прямых обращений к ORM/БД.
- **Не используют** UoW, авторизацию и механизм идемпотентности (согласно ТЗ).
- Роутеры структурированы по подсистемам:
  - `v1/session_controller.py`: инициализация сессии, получение состояния (`/state`), сидинг данных, сброс.
  - `v1/engineer_controller.py`: создание, удаление, перевод в оффлайн (`toggle_status`), XAI-объяснение.
  - `v1/task_controller.py`: создание, удаление, отмена (`cancel`), XAI-объяснение.
  - `v1/schedule_controller.py`: оптимизация (`/optimize`), оперативное перепланирование (`/replan`).
  - `v1/health_controller.py`: проверка жизнеспособности сервиса (`/health`).

### 2.2. Services (`backend/Services/`)
- Содержат всю ключевую бизнес-логику:
  - Проверка бизнес-правил (необратимость перевода инженера в оффлайн и автоматическое перемещение его заявок в нераспределенные).
  - Вызов встроенного движка оптимизации VRPTW и генерации объяснений без сетевого оверхеда.
  - Сборка агрегированного DTO состояния системы (`StateResponse`).
- **Все зависимости к БД инжектируются в конструктор `__init__`** в виде репозиториев (`EngineerRepository`, `TaskRepository`, etc.).

### 2.3. Repository (`backend/Repository/`)
- Абстракция над хранилищем данных.
- Каждый репозиторий работает со своей таблицей/сущностью:
  - `DispatcherRepository`
  - `EngineerRepository`
  - `TaskRepository`
  - `ScheduleRepository`
  - `ExplanationRepository`
  - `MetricsRepository`
- Предоставляет типизированные методы: `get_by_id`, `get_active_by_dispatcher`, `create`, `delete`, `set_status`, `bulk_create` и т.д.

### 2.4. Entities (`backend/Entities/`)
- Описание ORM-сущностей SQLAlchemy:
  - `Dispatcher`
  - `Engineer`
  - `Task`
  - `ScheduleRecord`
  - `ExplanationCache`
  - `PlanMetricsRecord`
- Настройки сессий и подключения к **PostgreSQL** (`database.py`), пул соединений с `pool_pre_ping=True`.

### 2.5. Models (`backend/Models/`)
- DTO (Data Transfer Objects) и схемы Pydantic:
  - Схемы запросов (`EngineerCreate`, `TaskCreate`, `SeedRequest`, `ReplanRequestIn`).
  - Схемы ответов (`StateResponse`, `EngineerOut`, `TaskOut`, `MetricsOut`, `ExplanationOut`).
  - DTO настроек `Settings` (`backend/Models/settings.py`), обязательные поля `port` (из `BACKEND_PORT`) и `database_url` (из `DATABASE_URL`) без дефолтов.

---

## 3. База данных PostgreSQL

- Контейнер `db` поднят в `docker-compose.yml` на базе образа `postgres:16-alpine`.
- В CI/CD пайплайне (`.github/workflows/ci.yml`) и интеграционных тестах (`test_e2e.py`) используется полноценный PostgreSQL сервис-контейнер (`postgres:16-alpine`), а для автономных легковесных локальных запусков без запущенного docker поддерживается изолированный in-memory режим.
