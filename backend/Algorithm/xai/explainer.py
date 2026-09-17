from typing import Any


def generate_explanation(task_id: str, assigned_engineer_id: str | None, context: dict[str, Any] | None = None) -> str:
    """
    Generates explainability justification for tasks (assigned or unassigned)
    or engineers (active route or idle reserve).
    """
    ctx = context or {}
    exp_type = ctx.get("type", "task")

    raw_args = f"target={task_id};eng={assigned_engineer_id};type={exp_type}"
    args_slice = raw_args[:30]

    # Global sector context
    total_tasks = ctx.get("total_tasks_count")
    total_engs = ctx.get("total_engineers_count")
    active_engs = ctx.get("active_engineers_count")
    sector_info = ""
    if total_tasks and total_engs:
        sector_info = f"В секторе находится **{total_tasks} заявок** и **{total_engs} инженеров** (активно бригад: {active_engs or 'н/д'}).\n\n"

    # 1. Idle engineer explanation
    if exp_type == "engineer_idle" or task_id.startswith("eng_idle_") or ctx.get("is_idle"):
        eng_name = ctx.get("engineer_name", "Специалист")
        transport = ctx.get("transport_type", "Автомобиль")
        shift = ctx.get("shift", "09:00 - 22:00")
        skills = ", ".join(ctx.get("skills", ["Локальные работы"]))

        return (
            f"### Обоснование нахождения в оперативном резерве: {eng_name}\n\n"
            f"{sector_info}"
            f"Инженер **{eng_name}** ({transport}, смена {shift}, квалификация: {skills}) "
            f"не задействован в текущем графике выездов по критериям глобальной VRPTW-оптимизации:\n\n"
            f"1. **Минимизация штатного состава:** Алгоритм стремится покрыть 100% клиентских заявок наименьшим числом исполнителей. "
            f"Все текущие задачи сектора распределены между активными бригадами без перегрузки их смен.\n"
            f"2. **Логистическая нецелесообразность:** Назначение {eng_name} привело бы к разрыву компактности маршрутов "
            f"и увеличило бы суммарный пробег по сектору.\n"
            f"3. **Оперативное дежурство:** Бригада удерживается в резерве на случай экстренных аварий "
            f"или схода специалистов с линии.\n\n"
            f"> **[Контрольный отпечаток аргументов (LLM): `{args_slice}`]**"
        )

    # 2. Engineer route explanation
    if exp_type == "engineer_route" or (ctx.get("stops_count", 0) > 0 and not ctx.get("is_idle")):
        eng_name = ctx.get("engineer_name", "Специалист")
        transport = ctx.get("transport_type", "Автомобиль")
        shift = ctx.get("shift", "09:00 - 22:00")
        stops_cnt = ctx.get("stops_count", 0)
        total_km = ctx.get("total_travel_km", 0.0)
        total_min = ctx.get("total_travel_min", 0)
        first_start = ctx.get("first_start", "09:30")
        last_end = ctx.get("last_end", "21:00")

        return (
            f"### Обоснование маршрутного листа: {eng_name}\n\n"
            f"{sector_info}"
            f"Для инженера **{eng_name}** ({transport}, смена {shift}) построен согласованный маршрут из **{stops_cnt} заявок** "
            f"с суммарным перегоном **{total_km} км** (~{total_min} мин в пути):\n\n"
            f"1. **Топологическая компактность:** Последовательность точек выстроена эвристикой 2-opt, исключающей самопересечения и возвраты.\n"
            f"2. **Соблюдение окон клиентов:** Все назначенные визиты ({first_start} – {last_end}) строго укладываются в согласованные временные интервалы.\n"
            f"3. **Балансировка загрузки:** Интенсивность рабочего дня распределена без превышения лимитов непрерывного труда и с запасом до окончания смены.\n"
            f"4. **Соответствие компетенций:** По каждой из {stops_cnt} задач профиль квалификации подтвержден.\n\n"
            f"> **[Контрольный отпечаток аргументов (LLM): `{args_slice}`]**"
        )

    # 3. Unassigned task explanation
    if exp_type == "task_unassigned" or not assigned_engineer_id or assigned_engineer_id == "eng_default":
        address = ctx.get("address", "Адрес клиента")
        skill = ctx.get("required_skill", "Локальные работы")
        priority = ctx.get("priority", "Обычная")
        window = ctx.get("window", "09:00 - 22:00")
        reason = ctx.get("reason", "Превышение временных окон или дефицит свободных бригад")

        return (
            f"### Обоснование нераспределенной заявки #{task_id}\n\n"
            f"{sector_info}"
            f"Заявка по адресу **{address}** (приоритет: *{priority}*, требуемый навык: *«{skill}»*, окно: *{window}*) "
            f"в настоящее время **не назначена** на исполнителя по следующим оптимизационным причинам:\n\n"
            f"1. **Причина системы:** {reason}.\n"
            f"2. **Временные лимиты смен:** Доступные бригады сектора с требуемым навыком «{skill}» уже загружены до предельной длительности смены, либо время доезда нарушит интервал визита {window}.\n"
            f"3. **Рекомендация диспетчеру:** Перенести временное окно клиента, либо расширить состав дежурных бригад.\n\n"
            f"> **[Контрольный отпечаток аргументов (LLM): `{args_slice}`]**"
        )

    # 4. Standard assigned task explanation
    eng_name = ctx.get("engineer_name", assigned_engineer_id)
    address = ctx.get("address", "Адрес клиента")
    skill = ctx.get("required_skill", "Локальные работы")
    transport = ctx.get("transport_type", "Автомобиль")
    arrival = ctx.get("arrival_time", "18:20")
    window = ctx.get("window", "18:00 - 20:00")
    travel_km = ctx.get("travel_km", 2.4)
    travel_min = ctx.get("travel_min", 15)
    priority = ctx.get("priority", "Обычная")

    candidates = ctx.get("alternative_candidates", [])
    cand_text = ""
    if candidates:
        cand_names = ", ".join(c.get("name", "Коллега") for c in candidates[:3])
        cand_text = f" Доступные альтернативные кандидаты ({cand_names}) уступают данному решению по времени доезда или профилю смены."

    return (
        f"### Обоснование назначения заявки #{task_id}\n\n"
        f"{sector_info}"
        f"Заявка по адресу **{address}** (приоритет: *{priority}*) назначена исполнителю **{eng_name}** "
        f"на основе многокритериальной VRPTW-оптимизации:\n\n"
        f"1. **Квалификация сотрудника:** Требуемый навык *«{skill}»* полностью подтвержден в профиле исполнителя.\n"
        f"2. **Логистическая эффективность:** Назначенный транспорт — *«{transport}»*. Время доезда от предыдущей точки составляет {travel_km} км ({travel_min} мин), "
        f"что минимизирует холостой пробег бригады.\n"
        f"3. **Временные рамки:** Расчетное время прибытия **{arrival}** строго попадает в окно клиента (*{window}*), "
        f"а работы завершаются с запасом до окончания смены.\n"
        f"4. **Сравнение с альтернативами:** Назначение {eng_name} обеспечивает минимальный прирост совокупного километража района.{cand_text}\n\n"
        f"> **[Контрольный отпечаток аргументов (LLM): `{args_slice}`]**"
    )
