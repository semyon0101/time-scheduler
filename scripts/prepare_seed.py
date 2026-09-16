import zipfile
import csv
import io
import json
import hashlib
import os

DISTRICT_COORDS = {
    # Восток
    'Таганский': (55.7420, 37.6580),
    'Басманный': (55.7680, 37.6650),
    'Лефортово': (55.7530, 37.7020),
    'Нижегородский': (55.7330, 37.7120),
    'Южнопортовый': (55.7150, 37.6750),
    'Текстильщики': (55.7060, 37.7330),
    'Кузьминки': (55.7050, 37.7650),
    'Рязанский': (55.7190, 37.7880),
    'Выхино': (55.7150, 37.8180),
    # Юго-восток
    'Царицыно': (55.6200, 37.6650),
    'Москворечье - Сабурово': (55.6500, 37.6800),
    'Орехово Борисово Северное': (55.6150, 37.7100),
    'Орехово Борисово Южное': (55.6000, 37.7200),
    'Зябликово': (55.6180, 37.7450),
    'Братеево': (55.6320, 37.7650),
    'Бирюлево Восточное': (55.5900, 37.6600),
    'Бирюлево Западное': (55.5850, 37.6400),
    'Домодедово': (55.4380, 37.7680),
    'Ступино': (54.8870, 38.0770),
    'Кашира': (54.8400, 38.1600),
    # Югоцентр
    'Даниловский': (55.7100, 37.6300),
    'GPON Даниловский': (55.7120, 37.6350),
    'Замоскворечье': (55.7340, 37.6320),
    'Хамовники': (55.7300, 37.5800),
    'Донской': (55.7050, 37.6000),
    'Академический': (55.6900, 37.5750),
    'Гагаринский': (55.7000, 37.5600),
    'Котловка': (55.6750, 37.6000),
    'Нагорный': (55.6700, 37.6200),
    'Зюзино': (55.6550, 37.5900),
    'Нагатино - Садовники': (55.6800, 37.6500),
    'Нагатинский Затон': (55.6850, 37.6950),
}

DEFAULT_MOSCOW_COORDS = (55.7350, 37.6700)

SKILLS_ALL = [
    "Локальные работы",
    "Работы на подключение и дозаказы",
    "Аварийные работы"
]

TRANSPORTS = [
    "Автомобиль",
    "Общественный транспорт",
    "Велосипед",
    "Пешеход"
]

def map_skill(type_hd, type_bk):
    hd_lower = (type_hd or '').lower()
    bk_lower = (type_bk or '').lower()
    combined = f"{hd_lower} {bk_lower}"
    
    if any(w in combined for w in ['авария', 'глобальн', 'ошибок на порту', 'нет линка', 'разрыв', 'ip-адрес']):
        return "Аварийные работы"
    if any(w in combined for w in ['подключени', 'дозаказ', 'конвергенция', 'гбит/с']):
        return "Работы на подключение и дозаказы"
    return "Локальные работы"

def get_coords(district, address):
    base_lat, base_lon = DISTRICT_COORDS.get(district, DEFAULT_MOSCOW_COORDS)
    # Add deterministic jitter based on address
    h = int(hashlib.md5((address or '').encode('utf-8')).hexdigest()[:8], 16)
    offset_lat = ((h % 1000) - 500) * 0.000025
    offset_lon = (((h // 1000) % 1000) - 500) * 0.000045
    return round(base_lat + offset_lat, 6), round(base_lon + offset_lon, 6)

def parse_time(val):
    # format like "17.08.2026 20:00" -> "20:00"
    if not val:
        return "18:00"
    val = val.strip()
    if ' ' in val:
        val = val.split(' ')[-1]
    parts = val.split(':')
    if len(parts) >= 2:
        return f"{int(parts[0]):02d}:{int(parts[1]):02d}"
    return "18:00"

def process_region(z, ctrl_filename, syn_filename, preset_key, preset_name):
    # Read control file to get engineers and assignments
    ctrl_rows = []
    if ctrl_filename:
        with z.open(ctrl_filename) as f:
            reader = csv.reader(io.TextIOWrapper(f, encoding='cp1251'), delimiter=';')
            header = [h.strip() for h in next(reader)]
            for r in reader:
                if r and any(r):
                    ctrl_rows.append(dict(zip(header, [c.strip() for c in r])))
    
    # Read synthetic data
    syn_rows = []
    with z.open(syn_filename) as f:
        reader = csv.reader(io.TextIOWrapper(f, encoding='cp1251'), delimiter=';')
        header = [h.strip() for h in next(reader)]
        for r in reader:
            if r and any(r):
                syn_rows.append(dict(zip(header, [c.strip() for c in r])))

    # Collect unique brigades/engineers from control
    brigade_names = sorted(list(set(r.get('Бригада') for r in ctrl_rows if r.get('Бригада'))))
    if not brigade_names:
        brigade_names = [f"Инженер {i+1}" for i in range(10)]

    # Generate engineers
    engineers = []
    # Calculate district center for starting base
    districts = list(set(r.get('Район') for r in syn_rows if r.get('Район') in DISTRICT_COORDS))
    if not districts:
        base_center = DEFAULT_MOSCOW_COORDS
    else:
        lats = [DISTRICT_COORDS[d][0] for d in districts]
        lons = [DISTRICT_COORDS[d][1] for d in districts]
        base_center = (sum(lats)/len(lats), sum(lons)/len(lons))

    for idx, b_name in enumerate(brigade_names):
        # Vary transport and skills realistically
        # 60% Car, 20% Transit, 10% Bike, 10% Pedestrian
        if idx % 4 == 0 or idx % 4 == 2:
            transport = "Автомобиль"
        elif idx % 4 == 1:
            transport = "Общественный транспорт"
        elif idx % 8 == 3:
            transport = "Велосипед"
        else:
            transport = "Пешеход"

        # Skills: all have at least 1, some have 2, senior have 3
        if idx % 3 == 0:
            skills = [SKILLS_ALL[0], SKILLS_ALL[1], SKILLS_ALL[2]] # All skills
        elif idx % 3 == 1:
            skills = [SKILLS_ALL[0], SKILLS_ALL[1]]
        else:
            skills = [SKILLS_ALL[0], SKILLS_ALL[2]]

        # Starting location slightly spread out around base center
        h = int(hashlib.md5(b_name.encode('utf-8')).hexdigest()[:6], 16)
        eng_lat = round(base_center[0] + ((h % 200) - 100) * 0.0002, 6)
        eng_lon = round(base_center[1] + (((h // 200) % 200) - 100) * 0.0003, 6)

        engineers.append({
            "id": f"eng_{preset_key}_{idx+1}",
            "name": b_name,
            "start_lat": eng_lat,
            "start_lon": eng_lon,
            "shift_start": "09:00",
            "shift_end": "22:00",
            "skills": skills,
            "transport_type": transport
        })

    # Generate tasks
    tasks = []
    # Map ctrl rows by ticket number for reference
    ctrl_map = {r.get('Заявка'): r.get('Бригада') for r in ctrl_rows if r.get('Заявка')}

    for idx, r in enumerate(syn_rows):
        task_id = r.get('Заявка') or f"task_{preset_key}_{idx+1}"
        address = r.get('Адрес') or "Москва"
        district = r.get('Район') or ""
        lat, lon = get_coords(district, address)

        w_start = parse_time(r.get('Начало'))
        w_end = parse_time(r.get('Окончание'))
        if w_start >= w_end:
            w_end = "22:00"

        req_skill = map_skill(r.get('Тип заявки HD'), r.get('Тип заявки BK'))
        
        # Gigabit connection or heavy connection requires car
        is_giga = (r.get('Гигабитное подключение') or '').lower() in ['да', 'true', '1']
        req_trans = "Автомобиль" if is_giga and (idx % 3 == 0) else None

        # Priority: regular, but 10% urgent
        priority = "Срочная" if (idx % 10 == 0) else "Обычная"

        ctrl_brigade = ctrl_map.get(task_id)

        tasks.append({
            "id": str(task_id),
            "address": address,
            "district": district,
            "lat": lat,
            "lon": lon,
            "window_start": w_start,
            "window_end": w_end,
            "duration_min": 45 if req_skill == "Локальные работы" else 60,
            "required_skill": req_skill,
            "required_transport": req_trans,
            "priority": priority,
            "control_assigned_engineer": ctrl_brigade
        })

    return {
        "preset": preset_key,
        "name": preset_name,
        "base_center": {"lat": round(base_center[0], 6), "lon": round(base_center[1], 6)},
        "engineers": engineers,
        "tasks": tasks
    }

def main():
    os.makedirs('backend/seed', exist_ok=True)
    with zipfile.ZipFile('Обезличивание.zip') as z:
        # Vostok
        vostok_data = process_region(
            z,
            'Обезличивание/Восток Контрольное распределение..csv',
            'Обезличивание/Восток Синтетические данные.csv',
            'vostok',
            'Восток'
        )
        with open('backend/seed/vostok.json', 'w', encoding='utf-8') as f:
            json.dump(vostok_data, f, ensure_ascii=False, indent=2)
        print(f"Saved vostok.json: {len(vostok_data['engineers'])} engineers, {len(vostok_data['tasks'])} tasks")

        # Yugovostok
        yugovostok_data = process_region(
            z,
            'Обезличивание/Юго-восток Контрольное распределение.csv',
            'Обезличивание/Юго-восток Синтетические данные.csv',
            'yugovostok',
            'Юго-восток'
        )
        with open('backend/seed/yugovostok.json', 'w', encoding='utf-8') as f:
            json.dump(yugovostok_data, f, ensure_ascii=False, indent=2)
        print(f"Saved yugovostok.json: {len(yugovostok_data['engineers'])} engineers, {len(yugovostok_data['tasks'])} tasks")

        # Yugocentr
        yugocentr_data = process_region(
            z,
            'Обезличивание/Югоцентр Контрольное распределение..csv',
            'Обезличивание/Югоцентр Синтетические данные.csv',
            'yugocentr',
            'Югоцентр'
        )
        with open('backend/seed/yugocentr.json', 'w', encoding='utf-8') as f:
            json.dump(yugocentr_data, f, ensure_ascii=False, indent=2)
        print(f"Saved yugocentr.json: {len(yugocentr_data['engineers'])} engineers, {len(yugocentr_data['tasks'])} tasks")

if __name__ == '__main__':
    main()
