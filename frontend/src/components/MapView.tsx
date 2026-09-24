import React, { useEffect, useRef } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import Feature from 'ol/Feature';
import LineString from 'ol/geom/LineString';
import { fromLonLat } from 'ol/proj';
import { Style, Stroke } from 'ol/style';
import Overlay from 'ol/Overlay';
import * as olExtent from 'ol/extent';
import { dataStore } from '../utils/DataStore';
import { PriorityEnum, TaskStatusEnum, EngineerStatusEnum, Focus } from '../types';

export interface MapViewProps {
  engineerIds?: string[];
  taskIds?: string[];
  selectedEngineerId?: string | null;
  selectedTaskId?: string | null;
  selectedRoadId?: string | null;
  focus?: Focus;
  onSetFocus?: (focus: Focus) => void;
  focusedSegment?: {
    from: [number, number];
    to: [number, number];
    engineerName?: string;
    travelMin?: number;
    travelKm?: number;
  } | null;
  onSelectEngineer: (engineerId: string) => void;
  onSelectTask: (taskId: string) => void;
  onSelectRoad?: (roadId: string) => void;
  onOpenExplanation?: (taskId: string) => void;
  onCancelTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onClearFocusedSegment?: () => void;
}

// Strictly no yellow/gold/amber or neon cyan in base palette
const ENGINEER_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#6366f1', // indigo-500
  '#f43f5e', // rose-500
  '#a855f7', // purple-500
  '#84cc16', // lime-500
  '#0284c7', // sky-600
  '#22c55e', // green-500
  '#d946ef', // fuchsia-500
];

const ACTIVE_ROUTE_COLOR = '#00f0ff'; // Neon Electric Cyan (reserved exclusively for active focus)
const ACTIVE_CASING_COLOR = '#0f172a'; // Deep slate dark casing for high contrast

export const MapView: React.FC<MapViewProps> = ({
  engineerIds,
  taskIds,
  selectedEngineerId,
  selectedTaskId,
  selectedRoadId,
  focus,
  onSetFocus,
  focusedSegment,
  onSelectEngineer,
  onSelectTask,
  onSelectRoad,
  onClearFocusedSegment,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const routesSourceRef = useRef<VectorSource>(new VectorSource());
  const travelSourceRef = useRef<VectorSource>(new VectorSource());
  const overlaysRef = useRef<Overlay[]>([]);
  const hasInitiallyFittedRef = useRef<boolean>(false);

  // Derive active focus entity IDs
  const effectiveEngineerId =
    focus?.kind === 'engineer'
      ? focus.id
      : focus?.kind === 'road'
      ? dataStore.find_by_id_roads(focus.id)?.engineer_id || null
      : selectedEngineerId;

  const effectiveTaskId = focus?.kind === 'task' ? focus.id : selectedTaskId;
  const effectiveRoadId = focus?.kind === 'road' ? focus.id : selectedRoadId;

  // Keep references to latest callbacks and props
  const latestPropsRef = useRef({
    engineerIds,
    taskIds,
    effectiveEngineerId,
    effectiveTaskId,
    effectiveRoadId,
    focusedSegment,
    onSetFocus,
    onSelectEngineer,
    onSelectTask,
    onSelectRoad,
    onClearFocusedSegment,
  });

  useEffect(() => {
    latestPropsRef.current = {
      engineerIds,
      taskIds,
      effectiveEngineerId,
      effectiveTaskId,
      effectiveRoadId,
      focusedSegment,
      onSetFocus,
      onSelectEngineer,
      onSelectTask,
      onSelectRoad,
      onClearFocusedSegment,
    };
  });

  // 1. Initialize OpenLayers 2D Canvas map on mount
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Day / Light raster layer: OpenStreetMap with 1:1 pixel rendering, no artificial scale
    const baseSource = new XYZ({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      interpolate: false,
      maxZoom: 19,
      attributions:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });

    // Automatic fallback to CARTO Positron if OSM policy blocks the browser
    baseSource.setTileLoadFunction((tile, src) => {
      const img = (tile as unknown as { getImage: () => HTMLImageElement }).getImage();
      img.crossOrigin = 'anonymous';
      img.onerror = () => {
        const match = src.match(/\/(\d+)\/(\d+)\/(\d+)\.png/);
        if (match) {
          const [, z, x, y] = match;
          img.onerror = null;
          img.src = `https://a.basemaps.cartocdn.com/rastertiles/light_all/${z}/${x}/${y}.png`;
        }
      };
      img.src = src;
    });

    const baseTileLayer = new TileLayer({
      source: baseSource,
    });

    // Vector layer for routes
    const routesLayer = new VectorLayer({
      source: routesSourceRef.current,
      zIndex: 10,
    });

    // Vector layer for focused travel segment
    const travelLayer = new VectorLayer({
      source: travelSourceRef.current,
      zIndex: 30,
    });

    const moscowCenter = fromLonLat([37.6176, 55.7558]);

    const map = new Map({
      target: mapContainerRef.current,
      layers: [baseTileLayer, routesLayer, travelLayer],
      view: new View({
        center: moscowCenter,
        zoom: 11,
        minZoom: 9,
        maxZoom: 19,
        constrainResolution: true, // Strict integer zoom to map tiles 1:1 with screen pixels
        smoothResolutionConstraint: false,
      }),
      controls: [], // Clean minimalist interface
    });

    // Map click interaction: features or canvas background
    map.on('click', (e) => {
      let clickedFeature: Feature | null = null;
      map.forEachFeatureAtPixel(e.pixel, (feature) => {
        if (!clickedFeature && feature instanceof Feature) {
          clickedFeature = feature;
        }
      });

      if (clickedFeature) {
        const roadId = (clickedFeature as Feature).get('roadId');
        const engId = (clickedFeature as Feature).get('engineerId');

        if (roadId) {
          if (latestPropsRef.current.onSetFocus) {
            latestPropsRef.current.onSetFocus({ kind: 'road', id: roadId });
          }
          if (latestPropsRef.current.onSelectRoad) {
            latestPropsRef.current.onSelectRoad(roadId);
          }
        } else if (engId) {
          if (latestPropsRef.current.onSetFocus) {
            latestPropsRef.current.onSetFocus({ kind: 'engineer', id: engId });
          }
          latestPropsRef.current.onSelectEngineer(engId);
        }
      } else {
        // Clicking map background / canvas clears focus
        if (latestPropsRef.current.onSetFocus) {
          latestPropsRef.current.onSetFocus(null);
        }
        if (latestPropsRef.current.focusedSegment && latestPropsRef.current.onClearFocusedSegment) {
          latestPropsRef.current.onClearFocusedSegment();
        }
      }
    });

    // Hover cursor styling
    map.on('pointermove', (e) => {
      const hit = map.hasFeatureAtPixel(e.pixel);
      map.getTargetElement().style.cursor = hit ? 'pointer' : '';
    });

    // Resize observer
    const ro = new ResizeObserver(() => {
      map.updateSize();
    });
    ro.observe(mapContainerRef.current);

    mapRef.current = map;

    return () => {
      ro.disconnect();
      overlaysRef.current.forEach((ov) => map.removeOverlay(ov));
      overlaysRef.current = [];
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  // 2. Render routes, markers, and viewports whenever state or focus changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous vector features & overlays
    routesSourceRef.current.clear();
    travelSourceRef.current.clear();
    overlaysRef.current.forEach((ov) => map.removeOverlay(ov));
    overlaysRef.current = [];

    const activeEngineerIds =
      engineerIds && engineerIds.length > 0
        ? engineerIds
        : dataStore.get_all_engineers().map((e) => e.id);

    const activeTaskIds =
      taskIds && taskIds.length > 0
        ? taskIds
        : dataStore.get_all_tasks().map((t) => t.id);

    const extent = olExtent.createEmpty();
    let hasCoords = false;

    const hasAnySelection = !!(effectiveEngineerId || effectiveTaskId || effectiveRoadId);

    // A. Render Routes & Engineer Depots
    activeEngineerIds.forEach((engId, engIdx) => {
      const eng = dataStore.find_by_id_engineer(engId);
      if (!eng) return;

      const isEngSelected = effectiveEngineerId === eng.id;
      const isUnavailable = eng.status === EngineerStatusEnum.UNAVAILABLE;
      const color = ENGINEER_COLORS[engIdx % ENGINEER_COLORS.length];

      // Depot coordinates
      const depotCoord = fromLonLat([eng.position.lon, eng.position.lat]);
      olExtent.extendCoordinate(extent, depotCoord);
      hasCoords = true;

      // Base Depot DOM Marker
      const depotEl = document.createElement('div');
      depotEl.className = 'depot-marker';
      depotEl.style.cursor = 'pointer';
      depotEl.innerHTML = `
        <div style="
          width: 30px;
          height: 30px;
          background: #0f172a;
          border: 2px solid ${isEngSelected ? ACTIVE_ROUTE_COLOR : color};
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          box-shadow: ${
            isEngSelected
              ? `0 0 16px ${ACTIVE_ROUTE_COLOR}, 0 4px 12px rgba(0,0,0,0.8)`
              : '0 4px 12px rgba(0,0,0,0.6)'
          };
          transform: ${isEngSelected ? 'scale(1.2)' : 'scale(1)'};
          transition: transform 0.2s, box-shadow 0.2s;
        ">
          🏠
        </div>
      `;
      depotEl.onclick = (e) => {
        e.stopPropagation();
        if (onSetFocus) onSetFocus({ kind: 'engineer', id: eng.id });
        onSelectEngineer(eng.id);
      };

      const depotOverlay = new Overlay({
        element: depotEl,
        positioning: 'center-center',
        stopEvent: true,
      });
      depotOverlay.setPosition(depotCoord);
      map.addOverlay(depotOverlay);
      overlaysRef.current.push(depotOverlay);

      // Build route segments from roads
      if (!isUnavailable && eng.roads && eng.roads.length > 0) {
        eng.roads.forEach((rId) => {
          const road = dataStore.find_by_id_roads(rId);
          if (!road || !road.from_pos || !road.to_pos) return;

          const cFrom = fromLonLat([road.from_pos.lon, road.from_pos.lat]);
          const cTo = fromLonLat([road.to_pos.lon, road.to_pos.lat]);
          olExtent.extendCoordinate(extent, cTo);

          const isRoadSelected = effectiveRoadId === road.id;

          const roadFeature = new Feature({
            geometry: new LineString([cFrom, cTo]),
            engineerId: eng.id,
            roadId: road.id,
          });

          const isThisRoadFocused = effectiveRoadId === road.id;

          if (isThisRoadFocused) {
            // Selected road segment: neon cyan #00f0ff with thick dark #0f172a casing and maximum zIndex
            roadFeature.setStyle([
              new Style({
                stroke: new Stroke({
                  color: ACTIVE_CASING_COLOR,
                  width: 12,
                  lineCap: 'round',
                  lineJoin: 'round',
                }),
                zIndex: 110,
              }),
              new Style({
                stroke: new Stroke({
                  color: ACTIVE_ROUTE_COLOR,
                  width: 8,
                  lineCap: 'round',
                  lineJoin: 'round',
                }),
                zIndex: 111,
              }),
            ]);

            // Travel segment badge at midpoint
            const midCoord = [(cFrom[0] + cTo[0]) / 2, (cFrom[1] + cTo[1]) / 2];
            const badgeEl = document.createElement('div');
            badgeEl.innerHTML = `
              <div style="
                background: #0f172a;
                color: #00f0ff;
                border: 1px solid #00f0ff;
                border-radius: 16px;
                padding: 3px 10px;
                font-size: 11px;
                font-weight: 700;
                display: flex;
                align-items: center;
                gap: 6px;
                box-shadow: 0 4px 14px rgba(0,0,0,0.8);
                user-select: none;
              ">
                <span>🚗 ${road.travel_min} мин (${road.travel_km} км)</span>
              </div>
            `;
            const badgeOverlay = new Overlay({
              element: badgeEl,
              positioning: 'bottom-center',
              stopEvent: false,
            });
            badgeOverlay.setPosition(midCoord);
            map.addOverlay(badgeOverlay);
            overlaysRef.current.push(badgeOverlay);
          } else if (effectiveRoadId) {
            // When a road is focused, keep contextual routes visible with lower opacity
            roadFeature.setStyle(
              new Style({
                stroke: new Stroke({
                  color: `${color}40`,
                  width: 2.5,
                  lineCap: 'round',
                  lineJoin: 'round',
                }),
                zIndex: 1,
              })
            );
          } else if (isEngSelected) {
            // Selected engineer's route: Electric Cyan #00f0ff with dark #0f172a casing
            const casingWidth = isRoadSelected ? 12 : 10;
            const coreWidth = isRoadSelected ? 8 : 6;
            const coreColor = ACTIVE_ROUTE_COLOR;

            roadFeature.setStyle([
              new Style({
                stroke: new Stroke({
                  color: ACTIVE_CASING_COLOR,
                  width: casingWidth,
                  lineCap: 'round',
                  lineJoin: 'round',
                }),
                zIndex: isRoadSelected ? 110 : 100,
              }),
              new Style({
                stroke: new Stroke({
                  color: coreColor,
                  width: coreWidth,
                  lineCap: 'round',
                  lineJoin: 'round',
                }),
                zIndex: isRoadSelected ? 111 : 101,
              }),
            ]);
          } else if (hasAnySelection) {
            // Dimmed unselected routes (opacity ~0.25)
            roadFeature.setStyle(
              new Style({
                stroke: new Stroke({
                  color: `${color}40`,
                  width: 2.5,
                  lineCap: 'round',
                  lineJoin: 'round',
                }),
                zIndex: 1,
              })
            );
          } else {
            // Standard day palette routes
            roadFeature.setStyle(
              new Style({
                stroke: new Stroke({
                  color: color,
                  width: 4,
                  lineCap: 'round',
                  lineJoin: 'round',
                }),
                zIndex: 10,
              })
            );
          }

          routesSourceRef.current.addFeature(roadFeature);
        });
      }

      // Render assigned task stop markers
      if (!isUnavailable && eng.tasks && eng.tasks.length > 0) {
        eng.tasks.forEach((taskId, stopIdx) => {
          const task = dataStore.find_by_id_task(taskId);
          if (!task || task.status === TaskStatusEnum.CANCELLED) return;

          const stopCoord = fromLonLat([task.position.lon, task.position.lat]);
          olExtent.extendCoordinate(extent, stopCoord);

          const isTaskActive = effectiveTaskId === task.id;
          const isUrgent = task.priority === PriorityEnum.URGENT;

          const stopEl = document.createElement('div');
          stopEl.className = 'stop-marker';
          stopEl.style.cursor = 'pointer';

          const markerBg = isTaskActive
            ? '#facc15'
            : isUrgent
            ? '#dc2626'
            : isEngSelected
            ? ACTIVE_ROUTE_COLOR
            : color;

          const markerTextColor = isTaskActive || (isEngSelected && !isUrgent) ? '#090d16' : '#ffffff';
          const markerBorder = isTaskActive
            ? '3px solid #ffffff'
            : isEngSelected
            ? '2px solid #0f172a'
            : `2px solid ${color}`;
          const markerScale = isTaskActive ? 'scale(1.3)' : isEngSelected ? 'scale(1.15)' : 'scale(1)';

          stopEl.innerHTML = `
            <div style="
              width: 26px;
              height: 26px;
              background: ${markerBg};
              color: ${markerTextColor};
              border: ${markerBorder};
              border-radius: ${isUrgent ? '6px' : '50%'};
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 11px;
              font-weight: 800;
              box-shadow: ${
                isTaskActive
                  ? '0 0 16px rgba(250, 204, 21, 0.9), 0 4px 12px rgba(0,0,0,0.8)'
                  : '0 2px 8px rgba(0,0,0,0.5)'
              };
              transform: ${markerScale};
              transition: transform 0.2s, box-shadow 0.2s;
            ">
              ${isUrgent ? '⚡' : stopIdx + 1}
            </div>
          `;

          stopEl.onclick = (e) => {
            e.stopPropagation();
            if (onSetFocus) onSetFocus({ kind: 'task', id: task.id });
            onSelectTask(task.id);
          };

          const stopOverlay = new Overlay({
            element: stopEl,
            positioning: 'center-center',
            stopEvent: true,
          });
          stopOverlay.setPosition(stopCoord);
          map.addOverlay(stopOverlay);
          overlaysRef.current.push(stopOverlay);
        });
      }
    });

    // B. Render Unassigned Problematic Tasks
    activeTaskIds.forEach((tId) => {
      const task = dataStore.find_by_id_task(tId);
      if (!task || task.engineer_id || task.status === TaskStatusEnum.CANCELLED) return;

      const coord = fromLonLat([task.position.lon, task.position.lat]);
      olExtent.extendCoordinate(extent, coord);
      hasCoords = true;

      const isTaskActive = effectiveTaskId === task.id;
      const isUrgent = task.priority === PriorityEnum.URGENT;

      const unassignedEl = document.createElement('div');
      unassignedEl.className = 'unassigned-marker';
      unassignedEl.style.cursor = 'pointer';

      unassignedEl.innerHTML = `
        <div style="
          width: 28px;
          height: 28px;
          background: ${isUrgent ? '#ef4444' : '#f59e0b'};
          color: #0f172a;
          border: 2px solid #ffffff;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 900;
          box-shadow: ${
            isTaskActive
              ? '0 0 16px rgba(239, 68, 68, 0.9), 0 4px 14px rgba(0,0,0,0.8)'
              : '0 4px 14px rgba(0,0,0,0.7)'
          };
          transform: ${isTaskActive ? 'scale(1.35) rotate(45deg)' : 'rotate(45deg)'};
          transition: transform 0.2s, box-shadow 0.2s;
        ">
          <span style="transform: rotate(-45deg);">${isUrgent ? '⚡' : '!'}</span>
        </div>
      `;

      unassignedEl.onclick = (e) => {
        e.stopPropagation();
        if (onSetFocus) onSetFocus({ kind: 'task', id: task.id });
        onSelectTask(task.id);
      };

      const unassignedOverlay = new Overlay({
        element: unassignedEl,
        positioning: 'center-center',
        stopEvent: true,
      });
      unassignedOverlay.setPosition(coord);
      map.addOverlay(unassignedOverlay);
      overlaysRef.current.push(unassignedOverlay);
    });

    // C. Render Focused Travel Segment
    if (focusedSegment && focusedSegment.from && focusedSegment.to) {
      const c1 = fromLonLat(focusedSegment.from);
      const c2 = fromLonLat(focusedSegment.to);

      const travelFeature = new Feature({
        geometry: new LineString([c1, c2]),
      });

      travelFeature.setStyle([
        new Style({
          stroke: new Stroke({
            color: '#0f172a',
            width: 10,
            lineCap: 'round',
          }),
        }),
        new Style({
          stroke: new Stroke({
            color: ACTIVE_ROUTE_COLOR,
            width: 6,
            lineDash: [8, 8],
            lineCap: 'round',
          }),
        }),
      ]);

      travelSourceRef.current.addFeature(travelFeature);

      // Midpoint badge
      const midCoord = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];
      const badgeEl = document.createElement('div');
      badgeEl.innerHTML = `
        <div style="
          background: #0f172a;
          color: #00f0ff;
          border: 1px solid #00f0ff;
          border-radius: 16px;
          padding: 3px 10px;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.8);
          user-select: none;
        ">
          <span>🚗 ${focusedSegment.travelMin || 0} мин (${focusedSegment.travelKm || 0} км)</span>
        </div>
      `;

      const badgeOverlay = new Overlay({
        element: badgeEl,
        positioning: 'bottom-center',
        stopEvent: false,
      });
      badgeOverlay.setPosition(midCoord);
      map.addOverlay(badgeOverlay);
      overlaysRef.current.push(badgeOverlay);

      const segExtent = olExtent.boundingExtent([c1, c2]);
      map.getView().fit(segExtent, { padding: [100, 100, 100, 100], maxZoom: 15, duration: 800 });
      return;
    }

    // D. Camera Animation on Selection
    if (effectiveRoadId) {
      const road = dataStore.find_by_id_roads(effectiveRoadId);
      if (road?.from_pos && road?.to_pos) {
        const c1 = fromLonLat([road.from_pos.lon, road.from_pos.lat]);
        const c2 = fromLonLat([road.to_pos.lon, road.to_pos.lat]);
        const segExtent = olExtent.boundingExtent([c1, c2]);
        map.getView().fit(segExtent, { padding: [80, 80, 80, 80], maxZoom: 15, duration: 800 });
        return;
      }
    }

    if (effectiveTaskId) {
      const task = dataStore.find_by_id_task(effectiveTaskId);
      if (task) {
        map.getView().animate({
          center: fromLonLat([task.position.lon, task.position.lat]),
          zoom: 14.5,
          duration: 800,
        });
        return;
      }
    }

    if (effectiveEngineerId) {
      const eng = dataStore.find_by_id_engineer(effectiveEngineerId);
      if (eng) {
        const engExtent = olExtent.createEmpty();
        olExtent.extendCoordinate(engExtent, fromLonLat([eng.position.lon, eng.position.lat]));
        if (eng.roads) {
          eng.roads.forEach((rId) => {
            const road = dataStore.find_by_id_roads(rId);
            if (road?.to_pos) {
              olExtent.extendCoordinate(engExtent, fromLonLat([road.to_pos.lon, road.to_pos.lat]));
            }
          });
        }
        if (!olExtent.isEmpty(engExtent)) {
          map.getView().fit(engExtent, { padding: [80, 80, 80, 80], maxZoom: 15, duration: 800 });
          return;
        }
      }
    }

    // Initial fit
    if (!hasInitiallyFittedRef.current && hasCoords && !olExtent.isEmpty(extent)) {
      hasInitiallyFittedRef.current = true;
      map.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 14, duration: 600 });
    }
  }, [
    engineerIds,
    taskIds,
    effectiveEngineerId,
    effectiveTaskId,
    effectiveRoadId,
    focusedSegment,
    focus,
  ]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full relative overflow-hidden bg-slate-100 select-none"
    />
  );
};
