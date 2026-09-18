import json
import os

import pytest

from scripts.build_seeds import (
    MAX_DISTANCE_KM,
    MOSCOW_CENTER_LAT,
    MOSCOW_CENTER_LON,
    DistanceExceededError,
    geocode_address,
    haversine_km,
    validate_distance_from_moscow,
)


def test_haversine_formula():
    """Verify haversine formula correctly calculates distance."""
    # Zero distance between identical points
    assert haversine_km(MOSCOW_CENTER_LAT, MOSCOW_CENTER_LON, MOSCOW_CENTER_LAT, MOSCOW_CENTER_LON) == 0.0

    # Moscow to Saint Petersburg is approx 630-640 km
    spb_lat, spb_lon = 59.9343, 30.3351
    dist_spb = haversine_km(MOSCOW_CENTER_LAT, MOSCOW_CENTER_LON, spb_lat, spb_lon)
    assert 620 < dist_spb < 650


def test_distance_validation_triggers_error():
    """Verify that coordinates further than 200 km raise DistanceExceededError."""
    # Point within Moscow (Red Square) -> within 200 km
    assert validate_distance_from_moscow(55.7539, 37.6208, "Красная Площадь") < MAX_DISTANCE_KM

    # Point in Kolomna (approx 100 km from Moscow) -> within 200 km
    assert validate_distance_from_moscow(55.0844, 38.7783, "Коломна") < MAX_DISTANCE_KM

    # Point in Saint Petersburg (~634 km) -> must raise DistanceExceededError
    with pytest.raises(DistanceExceededError):
        validate_distance_from_moscow(59.9343, 30.3351, "Санкт-Петербург")

    # Point in Almaty (~3100 km) -> must raise DistanceExceededError
    with pytest.raises(DistanceExceededError):
        validate_distance_from_moscow(43.230485, 76.867304, "Алматы")


def test_all_seed_datasets_within_moscow_bounds():
    """Verify all 6 seed datasets contain coordinates within 200 km of Moscow center."""
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(root_dir, "data")

    seed_files = [
        "vostok_syn.json",
        "vostok_ctrl.json",
        "yugovostok_syn.json",
        "yugovostok_ctrl.json",
        "yugcenter_syn.json",
        "yugcenter_ctrl.json",
    ]

    for fname in seed_files:
        fpath = os.path.join(data_dir, fname)
        assert os.path.exists(fpath), f"Seed file {fname} not found in {data_dir}"

        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)

        # 1. Check engineers
        engineers = data.get("engineers", [])
        assert len(engineers) > 0, f"No engineers found in {fname}"
        for eng in engineers:
            dist = validate_distance_from_moscow(
                eng["start_lat"],
                eng["start_lon"],
                f"Инженер {eng.get('name')}",
            )
            assert dist <= MAX_DISTANCE_KM, f"Engineer {eng.get('name')} in {fname} is {dist:.1f} km from Moscow"

        # 2. Check tasks
        tasks = data.get("tasks", [])
        assert len(tasks) > 0, f"No tasks found in {fname}"
        for task in tasks:
            dist = validate_distance_from_moscow(
                task["lat"],
                task["lon"],
                f"Заявка {task.get('address')}",
            )
            assert dist <= MAX_DISTANCE_KM, f"Task {task.get('address')} in {fname} is {dist:.1f} km from Moscow"


def test_geocoding_address_lookup():
    """Verify geocoding resolution produces valid coordinates within Moscow bounds."""
    test_addresses = [
        ("ул.3-я Институтская, д. 5 к 2", "Рязанский"),
        ("ул.1-я Дубровская, д. 6", "Южнопортовый"),
        ("ул.3-я Карачаровская, д. 4 к 1", "Нижегородский"),
        ("ул.2-я Синичкина, д. 9 к 1", "Лефортово"),
        ("ул.11-я Текстильщиков, д. 10", "Текстильщики"),
    ]

    for addr, district in test_addresses:
        lat, lon = geocode_address(addr, district)
        dist = validate_distance_from_moscow(lat, lon, addr)
        assert dist <= MAX_DISTANCE_KM, f"Address '{addr}' resolved to ({lat}, {lon}) which is {dist:.1f} km from Moscow"
