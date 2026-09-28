# Слоистая архитектура Backend (Layered Architecture)

## 1. Обзор архитектуры

Бэкенд спроектирован по канонической слоистой архитектуре (Layered Architecture). Оптимизация расписаний (VRPTW) и генерация объяснений (XAI) выполняются внутри `backend/Services/`, без отдельного сетевого микросервиса и порта. В `backend/Models/` находятся только DTO и схемы настроек. В качестве основной СУБД используется **PostgreSQL**.

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
    │      Repository      │   │   In-process VRPTW   │ <─── Сервисы маршрутизации
    │(backend/Repository/) │   │ (Services/routing/)  │      и объяснений
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
  - Проверка бизнес-правил (необратимость перевода инженера в оффлайн, сохранение начатых работ и перераспределение ещё не начатых заявок).
  - Оркестрация инженеров и вызов однодневного VRPTW-солвера (`routing/optimizer.py`, `routing/solver.py`), перепланирование (`routing/replanner.py`) и генерация объяснений (`explanation.py`) без сетевого оверхеда.
  - `routing/policy.py` задаёт единый допуск по участку/графику/навыкам и лексикографический порядок планов: число неназначенных аварий, защита более старых, реакция свыше 120 минут, покрытие подключений и остальных заявок, суммарная реакция, стабильность уже выданного плана, время пути, число инженеров, километры. Деньги и внутридневные остатки оборудования не моделируются; оборудование считается выданным на смену. Цель 60 минут показывается отдельно и не вытесняет покрытие заявок.
  - `ScheduleService.replan` читает исходные данные заявок и опубликованное расписание до изменения статусов. `routing/replanner.py` сохраняет начатые визиты, вставляет обычные заявки без сдвига опубликованных начал или пересчитывает незафиксированное будущее при аварии. Общая проверка порядка и времён находится в `routing/feasibility.py`. `ReplanRepository` сохраняет валидированный результат одним коммитом; прямые отмена заявки и снятие инженера с линии проходят через `ScheduleService.replan`.
  - Сборка агрегированного DTO состояния системы (`StateResponse`).
- **Все зависимости к БД инжектируются в конструктор `__init__`** в виде репозиториев (`EngineerRepository`, `TaskRepository`, etc.).

### 2.3. Repository (`backend/Repository/`)
- Абстракция над хранилищем данных.
- `schema_migrations.py` добавляет новые поля в существующие таблицы PostgreSQL без удаления данных: старые заявки получают категорию `other` (не выдаётся за аварию), участок восстанавливается из пресета диспетчера, а неизвестный `created_at` остаётся пустым.
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
  - DTO алгоритма (`optimization.py`) и VRPTW (`VRPTW/request.py`, `VRPTW/response.py`, `VRPTW/request_types.py`).
  - DTO настроек `Settings` (`backend/Models/settings.py`), обязательные поля `port` (из `BACKEND_PORT`) и `database_url` (из `DATABASE_URL`) без дефолтов.
  - Получение настроек вынесено в `backend/config.py`.

---

## 3. База данных PostgreSQL

- Контейнер `db` поднят в `docker-compose.yml` на базе образа `postgres:16-alpine`.
- В CI/CD пайплайне (`.github/workflows/ci.yml`) и интеграционных тестах (`test_e2e.py`) используется полноценный PostgreSQL сервис-контейнер (`postgres:16-alpine`), а для автономных легковесных локальных запусков без запущенного docker поддерживается изолированный in-memory режим.
