import math

# Average city speeds in km/h including traffic/stops
SPEEDS_KMH = {"Автомобиль": 35.0, "Общественный транспорт": 20.0, "Велосипед": 15.0, "Пешеход": 5.0}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great circle distance in kilometers using the Haversine formula."""
    r = 6371.0  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = r * c
    # Real road distance is roughly 1.3x Euclidean/Haversine in city grid
    return round(distance * 1.3, 2)


def calc_travel_min(distance_km: float, transport_type: str) -> int:
    """Calculates travel time in minutes based on distance and transport speed."""
    speed = SPEEDS_KMH.get(transport_type, 30.0)
    travel_hours = distance_km / speed
    minutes = round(travel_hours * 60)
    # Add small parking/access buffer
    buffer_min = 5 if transport_type == "Автомобиль" else 3
    return max(5, minutes + buffer_min)


def time_to_minutes(hh_mm: str) -> int:
    """Converts 'HH:MM' to minutes since midnight with safe fallback."""
    if not hh_mm or not isinstance(hh_mm, str):
        return 0
    parts = hh_mm.strip().split(":")
    if len(parts) < 2:
        return 0
    try:
        return int(parts[0]) * 60 + int(parts[1])
    except (ValueError, TypeError):
        return 0


def minutes_to_time(minutes: int) -> str:
    """Converts minutes since midnight to 'HH:MM' format."""
    minutes = minutes % (24 * 60)
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"
