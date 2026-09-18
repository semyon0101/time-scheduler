import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import { 
  EngineerRoute, 
  UnassignedTask, 
  Task, 
  Engineer, 
  MapFocusState, 
  TravelSegmentFocus,
  createEngineerFocus,
  createTaskFocus,
  createSegmentFocus
} from '../types';

export interface MapViewProps {
  routes: EngineerRoute[];
  allTasks: Task[];
  allEngineers: Engineer[];
  unassignedTasks: UnassignedTask[];
  focus?: MapFocusState;
  selectedEngineerId?: string | null;
  selectedTaskId?: string | null;
  focusedSegment?: TravelSegmentFocus | null;
  onSetFocus?: (focus: MapFocusState) => void;
  onClearFocus?: () => void;
  onSelectEngineer: (engineerId: string) => void;
  onSelectTask?: (taskId: string) => void;
  onOpenExplanation?: (taskId: string) => void;
  onCancelTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onClearFocusedSegment?: () => void;
}

// High-contrast route colors for light CARTO map background
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

// Inline SVG Depot Icon
const DEPOT_SVG = `
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
  <polyline points="9 22 9 12 15 12 15 22"/>
</svg>
`;

// Inline SVG Car Icon
const CAR_SVG = `
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
  <circle cx="7" cy="17" r="2"/>
  <path d="M9 17h6"/>
  <circle cx="17" cy="17" r="2"/>
</svg>
`;

export const MapView: React.FC<MapViewProps> = (props) => {
  const {
    routes,
    allTasks,
    allEngineers,
    unassignedTasks,
    focus,
    selectedEngineerId,
    selectedTaskId,
    focusedSegment
  } = props;

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null);
  const isMapLoadedRef = useRef(false);

  const hasInitiallyFittedRef = useRef(false);
  const lastDatasetKeyRef = useRef('');

  // Always keep a ref to the latest props so async callbacks read fresh state
  const propsRef = useRef(props);
  propsRef.current = props;

  // Resolve active focus values
  const activeEngineerId = focus?.type === 'engineer_route' 
    ? (focus.engineerId || null) 
    : (focus?.type === 'travel_segment' ? (focus.segment?.engineerId || null) : (selectedEngineerId || null));
  const activeTaskId = focus?.type === 'task' ? (focus.taskId || null) : (selectedTaskId || null);
  const activeSegment = focus?.type === 'travel_segment' ? (focus.segment || null) : (focusedSegment || null);

  const clearMarkers = () => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  };

  const renderMapContent = () => {
    const map = mapRef.current;
    if (!map || !isMapLoadedRef.current) return;

    clearMarkers();

    const currentProps = propsRef.current;
    const curRoutes = currentProps.routes || [];
    const curTasks = currentProps.allTasks || [];
    const curEngineers = currentProps.allEngineers || [];
    const curUnassigned = currentProps.unassignedTasks || [];

    const f = currentProps.focus;
    const curEngId = f?.type === 'engineer_route' 
      ? (f.engineerId || null) 
      : (f?.type === 'travel_segment' ? (f.segment?.engineerId || null) : (currentProps.selectedEngineerId || null));
    const curTaskId = f?.type === 'task' ? (f.taskId || null) : (currentProps.selectedTaskId || null);
    const curSegment = f?.type === 'travel_segment' ? (f.segment || null) : (currentProps.focusedSegment || null);

    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    let hasPoints = false;

    const safeExtend = (lat: number, lon: number) => {
      const numLat = Number(lat);
      const numLon = Number(lon);
      if (
        Number.isFinite(numLat) &&
        Number.isFinite(numLon) &&
        numLat >= -90 &&
        numLat <= 90 &&
        numLon >= -180 &&
        numLon <= 180 &&
        (numLat !== 0 || numLon !== 0)
      ) {
        if (numLon < minLng) minLng = numLon;
        if (numLat < minLat) minLat = numLat;
        if (numLon > maxLng) maxLng = numLon;
        if (numLat > maxLat) maxLat = numLat;
        hasPoints = true;
      }
    };

    // Find assigned route for curTaskId (Requirement 5: Route isolation)
    const taskAssignedRoute = curTaskId
      ? curRoutes.find((r) => r.stops.some((s) => s.task_id === curTaskId))
      : null;

    const routesToRender = curTaskId
      ? (taskAssignedRoute ? [taskAssignedRoute] : [])
      : curRoutes;

    // 1. Build GeoJSON Features for Routes
    const continuousFeatures: Feature<LineString>[] = [];
    const segmentFeatures: Feature<LineString>[] = [];

    routesToRender.forEach((route) => {
      if (!route.stops || route.stops.length === 0) return;

      const rIdx = curRoutes.findIndex((r) => r.engineer_id === route.engineer_id);
      const color = ROUTE_COLORS[(rIdx >= 0 ? rIdx : 0) % ROUTE_COLORS.length];
      const isSelected = curEngId === route.engineer_id || taskAssignedRoute?.engineer_id === route.engineer_id;
      const isDimmed = Boolean(!curTaskId && curEngId && curEngId !== route.engineer_id);

      const depotLat = Number(route.start_lat);
      const depotLon = Number(route.start_lon);

      // Sort stops strictly by order to ensure uninterrupted sequential connection
      const sortedStops = [...route.stops].sort((a, b) => (a.order || 0) - (b.order || 0));

      const continuousCoords: [number, number][] = [];
      if (Number.isFinite(depotLon) && Number.isFinite(depotLat)) {
        continuousCoords.push([depotLon, depotLat]);
        safeExtend(depotLat, depotLon);
      }

      for (let i = 0; i < sortedStops.length; i++) {
        const toStop = sortedStops[i];
        const fromLat = i === 0 ? depotLat : Number(sortedStops[i - 1].lat);
        const fromLon = i === 0 ? depotLon : Number(sortedStops[i - 1].lon);
        const toLat = Number(toStop.lat);
        const toLon = Number(toStop.lon);

        if (
          !Number.isFinite(fromLat) ||
          !Number.isFinite(fromLon) ||
          !Number.isFinite(toLat) ||
          !Number.isFinite(toLon) ||
          (fromLat === 0 && fromLon === 0) ||
          (toLat === 0 && toLon === 0)
        ) {
          continue;
        }

        safeExtend(fromLat, fromLon);
        safeExtend(toLat, toLon);
        continuousCoords.push([toLon, toLat]);

        const fromTitle = i === 0
          ? `База (${route.engineer_name})`
          : `Остановка #${sortedStops[i - 1].order} (Заявка #${sortedStops[i - 1].task_id})`;
        const toTitle = `Остановка #${toStop.order} (Заявка #${toStop.task_id}: ${toStop.address})`;

        // Per-leg segment for hitbox hovering and interaction
        segmentFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [fromLon, fromLat],
              [toLon, toLat]
            ]
          },
          properties: {
            segmentId: `${route.engineer_id}_leg_${i}`,
            engineerId: route.engineer_id,
            engineerName: route.engineer_name,
            travelKm: toStop.travel_km || 0,
            travelMin: toStop.travel_min || 0,
            fromTitle,
            toTitle,
            fromLon,
            fromLat,
            toLon,
            toLat
          }
        });
      }

      // Continuous full route line ensuring seamless connections between all stops
      if (continuousCoords.length >= 2) {
        continuousFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: continuousCoords
          },
          properties: {
            segmentId: `${route.engineer_id}_continuous`,
            engineerId: route.engineer_id,
            engineerName: route.engineer_name,
            color,
            casingColor: '#ffffff',
            opacity: isDimmed ? 0.2 : 1.0,
            casingOpacity: isDimmed ? 0.15 : 0.95,
            width: isSelected ? 5.5 : 3.5,
            casingWidth: isSelected ? 8.5 : 5.5,
            travelKm: route.total_distance_km || 0,
            travelMin: route.total_travel_min || 0
          }
        });
      }
    });

    const contSource = map.getSource('routes-continuous-source') as maplibregl.GeoJSONSource | undefined;
    if (contSource) {
      contSource.setData({
        type: 'FeatureCollection',
        features: continuousFeatures
      });
    }

    const segSource = map.getSource('routes-segments-source') as maplibregl.GeoJSONSource | undefined;
    if (segSource) {
      segSource.setData({
        type: 'FeatureCollection',
        features: segmentFeatures
      });
    }

    // 2. Focused Travel Segment (Requirements 3 & 4)
    const focusedSegFeatures: Feature<LineString>[] = [];
    if (curSegment && curSegment.from && curSegment.to) {
      const fromLon = curSegment.from[0];
      const fromLat = curSegment.from[1];
      const toLon = curSegment.to[0];
      const toLat = curSegment.to[1];

      focusedSegFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [fromLon, fromLat],
            [toLon, toLat]
          ]
        },
        properties: {}
      });

      // Floating Midpoint Badge (Requirements 3: solid dark background, inline SVG icon, NO cross button)
      const midLon = (fromLon + toLon) / 2;
      const midLat = (fromLat + toLat) / 2;

      const pillEl = document.createElement('div');
      pillEl.className = 'maplibre-travel-segment-pill';
      pillEl.style.cssText = `
        background-color: #0f172a;
        border: 2px solid #f59e0b;
        border-radius: 9999px;
        padding: 5px 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.85);
        display: flex;
        align-items: center;
        gap: 8px;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        user-select: none;
        pointer-events: auto;
        cursor: default;
      `;

      pillEl.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; shrink-0;">
          ${CAR_SVG}
        </div>
        <div style="display: flex; flex-direction: column;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 11px; font-weight: 800; color: #fef08a; letter-spacing: 0.2px;">
              ${curSegment.travelMin || 0} мин (${curSegment.travelKm || 0} км)
            </span>
            ${curSegment.engineerName ? `
              <span style="font-size: 10px; color: #94a3b8; border-left: 1px solid #334155; padding-left: 6px;">
                ${curSegment.engineerName}
              </span>
            ` : ''}
          </div>
          ${(curSegment.fromTitle || curSegment.toTitle) ? `
            <div style="font-size: 9px; color: #94a3b8; max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px;">
              ${curSegment.fromTitle || ''} → ${curSegment.toTitle || ''}
            </div>
          ` : ''}
        </div>
      `;

      const pillMarker = new maplibregl.Marker({ element: pillEl, anchor: 'center' })
        .setLngLat([midLon, midLat])
        .addTo(map);

      markersRef.current.push(pillMarker);

      // Smooth camera fit to focused segment
      const segMinLon = Math.min(fromLon, toLon);
      const segMaxLon = Math.max(fromLon, toLon);
      const segMinLat = Math.min(fromLat, toLat);
      const segMaxLat = Math.max(fromLat, toLat);
      map.fitBounds([[segMinLon, segMinLat], [segMaxLon, segMaxLat]], {
        padding: 90,
        maxZoom: 15,
        duration: 700
      });
    }

    const focusedSource = map.getSource('focused-seg-source') as maplibregl.GeoJSONSource | undefined;
    if (focusedSource) {
      focusedSource.setData({
        type: 'FeatureCollection',
        features: focusedSegFeatures
      });
    }

    // 3. Render Base Depot Markers
    const routeByEngId = new Map(curRoutes.map((r) => [r.engineer_id, r]));

    curEngineers.forEach((eng, idx) => {
      // If task is focused, only show depot of assigned engineer
      if (curTaskId) {
        if (!taskAssignedRoute || taskAssignedRoute.engineer_id !== eng.id) return;
      } else if (curEngId && curEngId !== eng.id) {
        return;
      }

      const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
      const route = routeByEngId.get(eng.id);
      const isIdle = !route || route.stops.length === 0;
      const isUnavailable = eng.status === 'unavailable';

      safeExtend(eng.start_lat, eng.start_lon);

      const strokeColor = isUnavailable ? '#ef4444' : (isIdle ? '#64748b' : color);
      const fillColor = isUnavailable ? '#450a0a' : (isIdle ? '#1e293b' : '#0f172a');
      const badgeText = isUnavailable ? 'Сход' : (isIdle ? 'Резерв' : 'База');

      const depotEl = document.createElement('div');
      depEl(depotEl, strokeColor, fillColor, badgeText);

      depotEl.addEventListener('click', (e) => {
        e.stopPropagation();
        propsRef.current.onSelectEngineer(eng.id);
        if (propsRef.current.onSetFocus) {
          propsRef.current.onSetFocus(createEngineerFocus(eng.id));
        }
      });

      const depotMarker = new maplibregl.Marker({ element: depotEl, anchor: 'center' })
        .setLngLat([eng.start_lon, eng.start_lat])
        .addTo(map);

      markersRef.current.push(depotMarker);
    });

    // 4. Render Task Stop Markers
    curRoutes.forEach((route, rIdx) => {
      const color = ROUTE_COLORS[rIdx % ROUTE_COLORS.length];
      if (curTaskId) {
        if (!taskAssignedRoute || taskAssignedRoute.engineer_id !== route.engineer_id) return;
      } else if (curEngId && curEngId !== route.engineer_id) {
        return;
      }

      route.stops.forEach((stop) => {
        safeExtend(stop.lat, stop.lon);

        const fullTask = curTasks.find((t) => t.id === stop.task_id);
        const isCancelled = fullTask?.status === 'cancelled';
        const isUrgent = stop.priority === 'Срочная' && !isCancelled;
        const isTaskActive = curTaskId === stop.task_id;

        const stopEl = document.createElement('div');
        renderStopHtml(stopEl, stop, color, isUrgent, isCancelled, isTaskActive);

        stopEl.addEventListener('click', (e) => {
          e.stopPropagation();
          if (propsRef.current.onSelectTask) {
            propsRef.current.onSelectTask(stop.task_id);
          }
          if (propsRef.current.onSetFocus) {
            propsRef.current.onSetFocus(createTaskFocus(stop.task_id));
          }
        });

        // Popup on hover
        const popupContent = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f1f5f9; padding: 4px; min-width: 210px; background: #0f172a; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 4px;">
              <strong style="color: #ffffff; font-size: 12px;">Заявка #${stop.task_id}</strong>
              <span style="background: #1e293b; color: #facc15; font-weight: 700; font-size: 10px; padding: 2px 6px; border-radius: 4px;">
                Остановка ${stop.order}
              </span>
            </div>
            <div style="color: #cbd5e1; font-size: 11px; margin-top: 4px; line-height: 1.3;">${stop.address}</div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; margin-top: 4px;">
              <span>Прибытие: <strong style="color: #facc15;">${stop.arrival_time}</strong></span>
              <span>Окно: <strong>${stop.start_time} - ${stop.end_time}</strong></span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid #334155; padding-top: 4px; margin-top: 4px;">
              <span>Инженер: <strong style="color: #ffffff;">${route.engineer_name}</strong></span>
              <span>Доезд: <strong>${stop.travel_km} км</strong> (~${stop.travel_min} мин)</span>
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({
          offset: [0, -14],
          closeButton: false,
          closeOnClick: false,
          className: 'maplibre-task-popup'
        }).setHTML(popupContent);

        stopEl.addEventListener('mouseenter', () => {
          popup.setLngLat([stop.lon, stop.lat]).addTo(map);
        });
        stopEl.addEventListener('mouseleave', () => {
          popup.remove();
        });

        const stopMarker = new maplibregl.Marker({ element: stopEl, anchor: 'center' })
          .setLngLat([stop.lon, stop.lat])
          .addTo(map);

        markersRef.current.push(stopMarker);
      });
    });

    // 5. Render Unassigned Problematic Tasks
    curUnassigned.forEach((u) => {
      const task = curTasks.find((t) => t.id === u.task_id);
      if (!task || task.status === 'cancelled') return;

      safeExtend(task.lat, task.lon);

      const isTaskActive = curTaskId === task.id;
      const isUrgent = task.priority === 'Срочная';

      const unassignedEl = document.createElement('div');
      renderUnassignedHtml(unassignedEl, isUrgent, isTaskActive);

      unassignedEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (propsRef.current.onSelectTask) {
          propsRef.current.onSelectTask(task.id);
        }
        if (propsRef.current.onSetFocus) {
          propsRef.current.onSetFocus(createTaskFocus(task.id));
        }
      });

      const unassignedMarker = new maplibregl.Marker({ element: unassignedEl, anchor: 'center' })
        .setLngLat([task.lon, task.lat])
        .addTo(map);

      markersRef.current.push(unassignedMarker);
    });

    // 6. Camera Movement for Active Focus
    if (!curSegment) {
      if (curTaskId) {
        const taskObj = curTasks.find((t) => t.id === curTaskId);
        if (taskObj && Number.isFinite(taskObj.lat) && Number.isFinite(taskObj.lon)) {
          map.flyTo({ center: [taskObj.lon, taskObj.lat], zoom: 14, duration: 700 });
          return;
        }
      }

      if (curEngId) {
        const eng = curEngineers.find((e) => e.id === curEngId);
        const r = curRoutes.find((rt) => rt.engineer_id === curEngId);
        let eMinLng = Infinity, eMinLat = Infinity, eMaxLng = -Infinity, eMaxLat = -Infinity;
        let eHasPoints = false;

        const extendE = (lat: number, lon: number) => {
          if (Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0)) {
            if (lon < eMinLng) eMinLng = lon;
            if (lat < eMinLat) eMinLat = lat;
            if (lon > eMaxLng) eMaxLng = lon;
            if (lat > eMaxLat) eMaxLat = lat;
            eHasPoints = true;
          }
        };

        if (eng) extendE(eng.start_lat, eng.start_lon);
        if (r) {
          r.stops.forEach((s) => extendE(s.lat, s.lon));
        }

        if (eHasPoints) {
          map.fitBounds([[eMinLng, eMinLat], [eMaxLng, eMaxLat]], { padding: 60, maxZoom: 14, duration: 700 });
          return;
        }
      }

      // Default: Fit all markers on initial load or dataset switch
      if (hasPoints && !hasInitiallyFittedRef.current) {
        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50, maxZoom: 13.5, duration: 600 });
        hasInitiallyFittedRef.current = true;
      }
    }
  };

  // Setup MapLibre GL Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'carto-voyager': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
              'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
              'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
              'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
          }
        },
        layers: [
          {
            id: 'carto-voyager-layer',
            type: 'raster',
            source: 'carto-voyager',
            minzoom: 0,
            maxzoom: 20
          }
        ]
      },
      center: [37.6176, 55.7558], // Moscow center [lon, lat]
      zoom: 11
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    const hoverPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
      className: 'maplibre-route-hover-popup'
    });
    hoverPopupRef.current = hoverPopup;

    map.on('load', () => {
      isMapLoadedRef.current = true;

      // 1. Continuous Route Lines Source & Layers
      map.addSource('routes-continuous-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Layer 1: Route casing (white contrast stroke on continuous line)
      map.addLayer({
        id: 'routes-casing-layer',
        type: 'line',
        source: 'routes-continuous-source',
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': '#ffffff',
          'line-width': ['coalesce', ['get', 'casingWidth'], 5.5],
          'line-opacity': ['coalesce', ['get', 'casingOpacity'], 0.95]
        }
      });

      // Layer 2: Main colored route lines (continuous connected polyline)
      map.addLayer({
        id: 'routes-colored-layer',
        type: 'line',
        source: 'routes-continuous-source',
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': ['to-color', ['coalesce', ['get', 'color'], '#2563eb']],
          'line-width': ['coalesce', ['get', 'width'], 3.5],
          'line-opacity': ['coalesce', ['get', 'opacity'], 1.0]
        }
      });

      // 2. Interactive Route Segments Source & Hitbox Layer
      map.addSource('routes-segments-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Layer 3: Transparent wide hitboxes for segment hovering & clicking (per leg)
      map.addLayer({
        id: 'routes-hitbox-layer',
        type: 'line',
        source: 'routes-segments-source',
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': '#000000',
          'line-width': 22,
          'line-opacity': 0.001
        }
      });

      // Add Focused Segment GeoJSON source
      map.addSource('focused-seg-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Focused Segment Casing
      map.addLayer({
        id: 'focused-seg-casing',
        type: 'line',
        source: 'focused-seg-source',
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': '#0f172a',
          'line-width': 10,
          'line-opacity': 0.95
        }
      });

      // Focused Segment Glowing Amber Dashed Line
      map.addLayer({
        id: 'focused-seg-line',
        type: 'line',
        source: 'focused-seg-source',
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': '#f59e0b',
          'line-width': 6,
          'line-dasharray': [2, 2],
          'line-opacity': 1.0
        }
      });

      // Route Hitbox Interactivity
      map.on('mouseenter', 'routes-hitbox-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'routes-hitbox-layer', () => {
        map.getCanvas().style.cursor = '';
        hoverPopup.remove();
      });

      map.on('mousemove', 'routes-hitbox-layer', (e) => {
        if (e.features && e.features[0]) {
          const p = e.features[0].properties as any;
          hoverPopup
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; padding: 4px; background: #0f172a; border-radius: 6px; border: 1px solid #334155; color: #f1f5f9; box-shadow: 0 4px 12px rgba(0,0,0,0.6);">
                <div style="font-weight: 800; color: #facc15;">🚗 Переезд: ${p.travelKm || 0} км (~${p.travelMin || 0} мин)</div>
                <div style="color: #cbd5e1; font-size: 10px; margin-top: 2px;">${p.fromTitle} → ${p.toTitle}</div>
                <div style="color: #94a3b8; font-size: 9px; margin-top: 2px;">Инженер: <strong style="color: #ffffff;">${p.engineerName}</strong></div>
                <div style="color: #38bdf8; font-size: 9px; margin-top: 3px; font-weight: bold;">⚡ Нажмите, чтобы выбрать этот путь</div>
              </div>
            `)
            .addTo(map);
        }
      });

      map.on('click', 'routes-hitbox-layer', (e) => {
        if (e.features && e.features[0]) {
          const p = e.features[0].properties as any;
          const segFocus: TravelSegmentFocus = {
            from: [Number(p.fromLon), Number(p.fromLat)],
            to: [Number(p.toLon), Number(p.toLat)],
            fromTitle: p.fromTitle,
            toTitle: p.toTitle,
            engineerId: p.engineerId,
            engineerName: p.engineerName,
            travelMin: Number(p.travelMin),
            travelKm: Number(p.travelKm)
          };
          propsRef.current.onSetFocus?.(createSegmentFocus(segFocus));
        }
      });

      // Click on background map clears focus
      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['routes-hitbox-layer'] });
        if (features && features.length > 0) return;

        propsRef.current.onClearFocusedSegment?.();
        propsRef.current.onClearFocus?.();
      });

      renderMapContent();
    });

    const ro = new ResizeObserver(() => {
      map.resize();
    });
    if (mapContainerRef.current) {
      ro.observe(mapContainerRef.current);
    }

    mapRef.current = map;

    return () => {
      ro.disconnect();
      clearMarkers();
      hoverPopup.remove();
      map.remove();
      mapRef.current = null;
      isMapLoadedRef.current = false;
    };
  }, []);

  // Update map contents when props change
  useEffect(() => {
    if (!mapRef.current || !isMapLoadedRef.current) return;
    const currentDatasetKey = `${allEngineers.length}_${allTasks.length}`;
    if (lastDatasetKeyRef.current !== currentDatasetKey) {
      lastDatasetKeyRef.current = currentDatasetKey;
      hasInitiallyFittedRef.current = false;
    }
    renderMapContent();
  }, [routes, allTasks, allEngineers, unassignedTasks, activeEngineerId, activeTaskId, activeSegment, focus?.nonce]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};

// Helper to style depot markers
function depEl(el: HTMLElement, strokeColor: string, fillColor: string, badgeText: string) {
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    filter: drop-shadow(0 3px 6px rgba(0,0,0,0.8));
    cursor: pointer;
    user-select: none;
  `;
  el.innerHTML = `
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      ${badgeText}
    </div>
  `;
}

// Helper to style stop markers
function renderStopHtml(
  el: HTMLElement,
  stop: any,
  color: string,
  isUrgent: boolean,
  isCancelled: boolean,
  isTaskActive: boolean
) {
  el.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    user-select: none;
  `;

  if (isCancelled) {
    el.innerHTML = `
      <div style="
        width: 22px;
        height: 22px;
        background-color: #475569;
        border: 1.5px solid #94a3b8;
        border-radius: 50%;
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
    el.innerHTML = `
      <div style="
        width: 30px;
        height: 30px;
        background-color: #d97706;
        border: 2px solid #ffffff;
        transform: rotate(45deg);
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
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
    el.innerHTML = `
      <div style="
        width: 26px;
        height: 26px;
        background-color: ${color};
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 3px 6px rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-weight: 800;
        font-size: 11px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ${isTaskActive ? 'outline: 3px solid #facc15; outline-offset: 3px;' : ''}
      ">
        ${stop.order}
      </div>
    `;
  }
}

// Helper to style unassigned problem markers
function renderUnassignedHtml(el: HTMLElement, isUrgent: boolean, isTaskActive: boolean) {
  el.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    user-select: none;
  `;

  if (isUrgent) {
    el.innerHTML = `
      <div style="
        width: 36px;
        height: 36px;
        background-color: #e11d48;
        border: 2.5px solid #ffffff;
        border-radius: 8px;
        transform: rotate(45deg);
        box-shadow: 0 0 16px rgba(225, 29, 72, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        ${isTaskActive ? 'outline: 4px solid #facc15; outline-offset: 3px;' : ''}
      ">
        <div style="
          transform: rotate(-45deg);
          color: #ffffff;
          font-weight: 900;
          font-size: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          line-height: 1;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          <span style="font-size: 11px; color: #fef08a;">⚡</span>
          <span style="font-size: 7.5px; font-weight: 900; letter-spacing: 0.5px;">СРОЧНО</span>
        </div>
      </div>
    `;
  } else {
    el.innerHTML = `
      <div style="
        width: 28px;
        height: 28px;
        background-color: #ea580c;
        border: 2px solid #ffffff;
        border-radius: 6px;
        transform: rotate(45deg);
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
}
