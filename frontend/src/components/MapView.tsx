import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { EngineerRoute, UnassignedTask, Task, Engineer } from '../types';

interface MapViewProps {
  routes: EngineerRoute[];
  allTasks: Task[];
  allEngineers: Engineer[];
  unassignedTasks: UnassignedTask[];
  selectedEngineerId?: string | null;
  selectedTaskId?: string | null;
  focusedSegment?: {
    from: [number, number];
    to: [number, number];
    engineerName?: string;
    travelMin?: number;
    travelKm?: number;
  } | null;
  onSelectEngineer: (engineerId: string) => void;
  onSelectTask?: (taskId: string) => void;
  onOpenExplanation?: (taskId: string) => void;
  onCancelTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onClearFocusedSegment?: () => void;
}

// Vibrant, high-contrast route colors for light, colorful map background
const ROUTE_COLORS = [
  '#2563eb', // Blue
  '#059669', // Emerald
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#db2777', // Pink
  '#0891b2', // Cyan
  '#ea580c', // Dark Orange
  '#65a30d', // Lime
  '#0d9488', // Teal
  '#9333ea', // Violet
  '#dc2626', // Red
  '#4f46e5'  // Indigo
];

// Inline SVG Depot / Station Icon (pure SVG, 0 missing glyphs)
const DEPOT_SVG = `
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
  <polyline points="9 22 9 12 15 12 15 22"/>
</svg>
`;

export const MapView: React.FC<MapViewProps> = ({
  routes,
  allTasks,
  allEngineers,
  unassignedTasks,
  selectedEngineerId,
  selectedTaskId,
  focusedSegment,
  onSelectEngineer,
  onSelectTask,
  onOpenExplanation,
  onCancelTask,
  onDeleteTask,
  onClearFocusedSegment
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const isMapLoadedRef = useRef(false);
  const hasInitiallyFittedRef = useRef(false);
  const lastDatasetKeyRef = useRef('');

  // Initialize MapLibre GL map with CARTO Voyager raster tiles
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [37.6176, 55.7558], // Moscow center [lon, lat]
      zoom: 11
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      isMapLoadedRef.current = true;

      // 1. Initialize Route Polyline Source & Static Layers
      if (!map.getSource('source-routes-all')) {
        map.addSource('source-routes-all', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        // Layer 1: Glow line
        map.addLayer({
          id: 'layer-routes-glow',
          type: 'line',
          source: 'source-routes-all',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['case', ['get', 'isSelected'], 14, 6],
            'line-opacity': [
              'case',
              ['get', 'isDimmed'],
              0.05,
              ['case', ['get', 'isSelected'], 0.45, 0.2]
            ]
          }
        });

        // Layer 2: White casing line for high contrast over colorful map
        map.addLayer({
          id: 'layer-routes-casing',
          type: 'line',
          source: 'source-routes-all',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#ffffff',
            'line-width': ['case', ['get', 'isSelected'], 8, 5.5],
            'line-opacity': ['case', ['get', 'isDimmed'], 0.25, 0.95]
          }
        });

        // Layer 3: Main colored route polyline
        map.addLayer({
          id: 'layer-routes-main',
          type: 'line',
          source: 'source-routes-all',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['case', ['get', 'isSelected'], 5, 3.5],
            'line-opacity': ['case', ['get', 'isDimmed'], 0.25, 0.95]
          }
        });

        map.on('click', 'layer-routes-main', (e) => {
          const f = e.features?.[0];
          if (f?.properties?.engineerId) {
            onSelectEngineer(f.properties.engineerId);
          }
        });

        map.on('mouseenter', 'layer-routes-main', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'layer-routes-main', () => {
          map.getCanvas().style.cursor = '';
        });
      }

      // 2. Initialize Focused Travel Segment Source & Layers
      if (!map.getSource('source-focused-travel')) {
        map.addSource('source-focused-travel', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        map.addLayer({
          id: 'layer-focused-travel-casing',
          type: 'line',
          source: 'source-focused-travel',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#0f172a',
            'line-width': 10,
            'line-opacity': 0.95
          }
        });

        map.addLayer({
          id: 'layer-focused-travel-main',
          type: 'line',
          source: 'source-focused-travel',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#f59e0b',
            'line-width': 6,
            'line-opacity': 1.0,
            'line-dasharray': [2, 1]
          }
        });
      }

      // Reset focused travel segment on background map click
      map.on('click', (e) => {
        // If clicked directly on map background without hitting markers
        const target = e.originalEvent?.target as HTMLElement;
        if (target && target.tagName === 'CANVAS') {
          if (onClearFocusedSegment) {
            onClearFocusedSegment();
          }
        }
      });

      renderMapContent();
    });

    // ResizeObserver ensures canvas lines render correctly in CSS grid/flex layouts
    const ro = new ResizeObserver(() => {
      map.resize();
    });
    if (mapContainerRef.current) {
      ro.observe(mapContainerRef.current);
    }

    mapRef.current = map;

    return () => {
      ro.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      isMapLoadedRef.current = false;
    };
  }, []);

  // Update routes, markers and viewport whenever state changes
  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    const currentDatasetKey = `${allEngineers.length}_${allTasks.length}`;
    if (lastDatasetKeyRef.current !== currentDatasetKey) {
      lastDatasetKeyRef.current = currentDatasetKey;
      hasInitiallyFittedRef.current = false;
    }
    renderMapContent();
  }, [routes, allTasks, allEngineers, unassignedTasks, selectedEngineerId, selectedTaskId, focusedSegment]);

  const renderMapContent = () => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;

    // 1. Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds = new maplibregl.LngLatBounds();
    let hasPoints = false;

    const safeExtend = (lon: number, lat: number) => {
      const numLon = Number(lon);
      const numLat = Number(lat);
      if (
        Number.isFinite(numLon) &&
        Number.isFinite(numLat) &&
        numLat >= -90 &&
        numLat <= 90 &&
        numLon >= -180 &&
        numLon <= 180 &&
        (numLon !== 0 || numLat !== 0)
      ) {
        bounds.extend([numLon, numLat]);
        hasPoints = true;
      }
    };

    // 2. Build GeoJSON FeatureCollection for all routes
    const routeFeatures: Feature<LineString>[] = [];

    routes.forEach((route, idx) => {
      if (!route.stops || route.stops.length === 0) return;

      const rawCoords = [
        [Number(route.start_lon), Number(route.start_lat)],
        ...route.stops.map((s) => [Number(s.lon), Number(s.lat)])
      ];

      // Validate coordinates
      const cleanCoords = rawCoords.filter(
        ([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && lon !== 0 && lat !== 0
      ) as [number, number][];

      if (cleanCoords.length < 2) return;

      const isSelected = selectedEngineerId === route.engineer_id;
      const isDimmed = Boolean(selectedEngineerId && selectedEngineerId !== route.engineer_id);
      const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];

      routeFeatures.push({
        type: 'Feature',
        id: route.engineer_id,
        properties: {
          engineerId: route.engineer_id,
          engineerName: route.engineer_name,
          color,
          isSelected,
          isDimmed
        },
        geometry: {
          type: 'LineString',
          coordinates: cleanCoords
        }
      });
    });

    const routesSource = map.getSource('source-routes-all') as maplibregl.GeoJSONSource | undefined;
    if (routesSource) {
      routesSource.setData({
        type: 'FeatureCollection',
        features: routeFeatures
      });
    }

    // 3. Render Base Depot Markers
    const routeByEngId = new Map(routes.map((r) => [r.engineer_id, r]));

    allEngineers.forEach((eng, idx) => {
      const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
      const route = routeByEngId.get(eng.id);
      const isIdle = !route || route.stops.length === 0;
      const isUnavailable = eng.status === 'unavailable';
      const isSelected = selectedEngineerId === eng.id;
      const isDimmed = Boolean(selectedEngineerId && selectedEngineerId !== eng.id);

      if (isDimmed) return;

      safeExtend(eng.start_lon, eng.start_lat);

      const el = document.createElement('div');
      el.className = 'base-depot-marker';
      el.style.cursor = 'pointer';
      el.style.zIndex = '15';

      const strokeColor = isUnavailable ? '#ef4444' : (isIdle ? '#64748b' : color);
      const fillColor = isUnavailable ? '#450a0a' : (isIdle ? '#1e293b' : '#0f172a');
      const badgeText = isUnavailable ? 'Сход' : (isIdle ? 'Резерв' : 'База');

      el.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          filter: drop-shadow(0 3px 6px rgba(0,0,0,0.8));
          transform: translate(-50%, -50%);
        ">
          <div style="
            background: ${fillColor};
            border: 2px solid ${strokeColor};
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
          ">
            ${DEPOT_SVG}
          </div>
          <div style="
            margin-top: 2px;
            background: ${strokeColor};
            color: #ffffff;
            font-size: 9px;
            font-weight: 800;
            padding: 1px 4px;
            border-radius: 4px;
            white-space: nowrap;
            letter-spacing: 0.2px;
          ">
            ${badgeText}
          </div>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectEngineer(eng.id);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([eng.start_lon, eng.start_lat])
        .addTo(map);

      markersRef.current.push(marker);
    });

    // 4. Render Task Stop Markers
    routes.forEach((route, rIdx) => {
      const color = ROUTE_COLORS[rIdx % ROUTE_COLORS.length];
      const isSelectedRoute = selectedEngineerId === route.engineer_id;
      const isDimmed = Boolean(selectedEngineerId && selectedEngineerId !== route.engineer_id);

      if (isDimmed) return;

      route.stops.forEach((stop) => {
        safeExtend(stop.lon, stop.lat);

        const fullTask = allTasks.find((t) => t.id === stop.task_id);
        const isCancelled = fullTask?.status === 'cancelled';
        const isUrgent = stop.priority === 'Срочная' && !isCancelled;
        const isTaskActive = selectedTaskId === stop.task_id;

        const el = document.createElement('div');
        el.className = 'stop-marker-item';
        el.style.cursor = 'pointer';

        if (isCancelled) {
          el.style.zIndex = '5';
          // Hierarchy Level 1: Cancelled tasks (lowest visual attention, greyed out)
          el.innerHTML = `
            <div style="
              width: 22px;
              height: 22px;
              background-color: #475569;
              border: 1.5px solid #94a3b8;
              border-radius: 50%;
              transform: translate(-50%, -50%);
              box-shadow: 0 2px 4px rgba(0,0,0,0.4);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #cbd5e1;
              font-weight: 800;
              font-size: 10px;
              opacity: 0.55;
              ${isTaskActive ? 'outline: 3px solid #facc15; outline-offset: 2px;' : ''}
            ">
              ✕
            </div>
          `;
        } else if (isUrgent) {
          el.style.zIndex = '20';
          // Hierarchy Level 3: Assigned Urgent Task (clean diamond with lightning ⚡, NO exclamation mark !)
          el.innerHTML = `
            <div style="
              width: 32px;
              height: 32px;
              background-color: #d97706;
              border: 2px solid #ffffff;
              transform: translate(-50%, -50%) rotate(45deg);
              box-shadow: 0 4px 8px rgba(0,0,0,0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              ${isTaskActive ? 'outline: 3px solid #facc15; outline-offset: 3px;' : ''}
            ">
              <div style="
                transform: rotate(-45deg);
                color: #ffffff;
                font-weight: 900;
                font-size: 11px;
                font-family: sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                line-height: 1;
              ">
                <span>#${stop.order}</span>
                <span style="font-size: 8px; color: #fef08a;">⚡</span>
              </div>
            </div>
          `;
        } else {
          el.style.zIndex = '10';
          // Hierarchy Level 2: Regular assigned circular stop marker
          el.innerHTML = `
            <div style="
              width: 26px;
              height: 26px;
              background-color: ${color};
              border: 2px solid #ffffff;
              border-radius: 50%;
              transform: translate(-50%, -50%);
              box-shadow: 0 3px 6px rgba(0,0,0,0.6);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-weight: 800;
              font-size: 11px;
              font-family: sans-serif;
              ${isTaskActive ? 'outline: 3px solid #facc15; outline-offset: 3px;' : ''}
            ">
              ${stop.order}
            </div>
          `;
        }

        // Click selects task
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (onSelectTask) {
            onSelectTask(stop.task_id);
          }
        });

        // Interactive popup
        const popupContent = document.createElement('div');
        popupContent.className = 'text-xs text-slate-100 p-2 min-w-[220px] bg-slate-900 rounded-lg space-y-1.5 font-sans';
        popupContent.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 4px;">
            <strong style="color: #ffffff; font-size: 12px;">Заявка #${stop.task_id}</strong>
            <span style="background: #1e293b; color: #facc15; font-weight: 700; font-size: 10px; padding: 2px 6px; border-radius: 4px;">
              Остановка ${stop.order}
            </span>
          </div>
          <div style="color: #cbd5e1; font-size: 11px;">${stop.address}</div>
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8;">
            <span>Прибытие: <strong style="color: #facc15;">${stop.arrival_time}</strong></span>
            <span>Окно: <strong>${stop.start_time} - ${stop.end_time}</strong></span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #334155; padding-top: 4px;">
            <span>Инженер: <strong style="color: #ffffff;">${route.engineer_name}</strong></span>
            <span>Доезд: <strong>${stop.travel_km} км</strong> (~${stop.travel_min} мин)</span>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 15, closeButton: false }).setDOMContent(popupContent);
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([stop.lon, stop.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
      });
    });

    // 5. Render Unassigned Problematic Tasks
    unassignedTasks.forEach((u) => {
      const task = allTasks.find((t) => t.id === u.task_id);
      if (!task || task.status === 'cancelled') return;

      safeExtend(task.lon, task.lat);

      const isTaskActive = selectedTaskId === task.id;
      const isUrgent = task.priority === 'Срочная';

      const el = document.createElement('div');
      el.className = 'unassigned-marker';
      el.style.cursor = 'pointer';

      if (isUrgent) {
        el.style.zIndex = '40';
        // Hierarchy Level 5: Problematic URGENT Task (highest visual attention: pulsing red glow, ⚡, NO exclamation mark)
        el.innerHTML = `
          <div style="
            width: 38px;
            height: 38px;
            background-color: #e11d48;
            border: 2.5px solid #ffffff;
            border-radius: 8px;
            transform: translate(-50%, -50%) rotate(45deg);
            box-shadow: 0 0 18px rgba(225, 29, 72, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            ${isTaskActive ? 'outline: 4px solid #facc15; outline-offset: 3px;' : ''}
          ">
            <div style="
              transform: rotate(-45deg);
              color: #ffffff;
              font-weight: 900;
              font-size: 11px;
              display: flex;
              flex-direction: column;
              align-items: center;
              line-height: 1;
            ">
              <span style="font-size: 12px; color: #fef08a;">⚡</span>
              <span style="font-size: 8px; font-weight: 900; letter-spacing: 0.5px;">СРОЧНО</span>
            </div>
          </div>
        `;
      } else {
        el.style.zIndex = '30';
        // Hierarchy Level 4: Problematic NORMAL Task (amber diamond with Н/Н, NO exclamation mark)
        el.innerHTML = `
          <div style="
            width: 28px;
            height: 28px;
            background-color: #ea580c;
            border: 2px solid #ffffff;
            border-radius: 6px;
            transform: translate(-50%, -50%) rotate(45deg);
            box-shadow: 0 3px 8px rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 10px;
            font-weight: 900;
            ${isTaskActive ? 'outline: 3px solid #facc15; outline-offset: 2px;' : ''}
          ">
            <div style="transform: rotate(-45deg); font-family: monospace; font-weight: 800;">Н/Н</div>
          </div>
        `;
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onSelectTask) onSelectTask(task.id);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([task.lon, task.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });

    // 6. Focus on Travel Segment (Requirement 8 & Point 4 reset)
    const focusedSource = map.getSource('source-focused-travel') as maplibregl.GeoJSONSource | undefined;

    if (focusedSegment && focusedSegment.from && focusedSegment.to) {
      const segGeoJson: FeatureCollection<LineString> = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [focusedSegment.from, focusedSegment.to]
            }
          }
        ]
      };

      if (focusedSource) {
        focusedSource.setData(segGeoJson);
      }

      // Midpoint badge with DISMISS BUTTON [✕] (Point 4: problem with reset resolved!)
      const midLon = (focusedSegment.from[0] + focusedSegment.to[0]) / 2;
      const midLat = (focusedSegment.from[1] + focusedSegment.to[1]) / 2;
      const segEl = document.createElement('div');
      segEl.innerHTML = `
        <div style="
          background: #0f172a;
          border: 2px solid #f59e0b;
          color: #fef08a;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 800;
          box-shadow: 0 4px 14px rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          transform: translate(-50%, -50%);
          font-family: sans-serif;
          cursor: pointer;
        ">
          <span>🚗 ${focusedSegment.travelMin || 0} мин (${focusedSegment.travelKm || 0} км)</span>
          <span id="btn-dismiss-seg" style="
            background: #334155;
            color: #ffffff;
            border-radius: 50%;
            width: 16px;
            height: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            margin-left: 2px;
          " title="Сбросить выбор пути">✕</span>
        </div>
      `;

      segEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onClearFocusedSegment) {
          onClearFocusedSegment();
        }
      });

      const segMarker = new maplibregl.Marker({ element: segEl })
        .setLngLat([midLon, midLat])
        .addTo(map);
      markersRef.current.push(segMarker);

      // Smooth camera fit to this travel path
      const segBounds = new maplibregl.LngLatBounds();
      segBounds.extend(focusedSegment.from);
      segBounds.extend(focusedSegment.to);
      map.fitBounds(segBounds, { padding: 120, maxZoom: 15.5, duration: 900 });
      return;
    } else {
      if (focusedSource) {
        focusedSource.setData({ type: 'FeatureCollection', features: [] });
      }
    }

    // 7. Camera Movement
    if (selectedTaskId) {
      const taskObj = allTasks.find((t) => t.id === selectedTaskId);
      if (taskObj) {
        map.flyTo({
          center: [taskObj.lon, taskObj.lat],
          zoom: 14.5,
          duration: 900
        });
        return;
      }
    }

    if (selectedEngineerId) {
      const eng = allEngineers.find((e) => e.id === selectedEngineerId);
      const r = routes.find((rt) => rt.engineer_id === selectedEngineerId);
      const engBounds = new maplibregl.LngLatBounds();

      if (eng) engBounds.extend([eng.start_lon, eng.start_lat]);
      if (r) {
        r.stops.forEach((s) => engBounds.extend([s.lon, s.lat]));
      }

      if (!engBounds.isEmpty()) {
        map.fitBounds(engBounds, { padding: 60, maxZoom: 14, duration: 900 });
        return;
      }
    }

    // Default: Fit all markers on initial load or dataset switch
    if (hasPoints && !bounds.isEmpty() && !hasInitiallyFittedRef.current) {
      map.fitBounds(bounds, { padding: 50, maxZoom: 13.5, duration: 600 });
      hasInitiallyFittedRef.current = true;
    }
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};
