import math

# Shared travel model for FIFO, replanning and the OR-Tools solver.
SPEEDS_KMH = {"Автомобиль": 40.0, "Общественный транспорт": 20.0, "Велосипед": 15.0, "Пешеход": 5.0}
MOSCOW_NETWORK_DETOUR_FACTOR = 1.3


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great circle distance in kilometers using the Haversine formula."""
    r = 6371.0  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def road_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Approximate Moscow road-network distance from straight-line distance."""
    return haversine_km(lat1, lon1, lat2, lon2) * MOSCOW_NETWORK_DETOUR_FACTOR


def calc_travel_min(distance_km: float, transport_type: str) -> int:
    """Calculates travel time in minutes based on distance and transport speed."""
    speed = SPEEDS_KMH.get(transport_type, 30.0)
    return math.ceil(distance_km / speed * 60)


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
