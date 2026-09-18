export interface Engineer {
  id: string;
  name: string;
  start_lat: number;
  start_lon: number;
  shift_start: string;
  shift_end: string;
  skills: string[];
  transport_type: string;
  status?: string; // "active" | "unavailable" | "new"
}

export interface Task {
  id: string;
  address: string;
  district?: string;
  lat: number;
  lon: number;
  window_start: string;
  window_end: string;
  duration_min: number;
  required_skill: string;
  required_transport?: string | null;
  priority: string;
  status?: string; // "active" | "cancelled" | "new"
  control_assigned_engineer?: string | null;
}

export interface ScheduleStop {
  task_id: string;
  address: string;
  district?: string;
  lat: number;
  lon: number;
  order: number;
  arrival_time: string;
  start_time: string;
  end_time: string;
  travel_km: number;
  travel_min: number;
  required_skill: string;
  priority: string;
}

export interface EngineerRoute {
  engineer_id: string;
  engineer_name: string;
  transport_type: string;
  skills: string[];
  start_lat: number;
  start_lon: number;
  shift_start: string;
  shift_end: string;
  stops: ScheduleStop[];
  total_distance_km: number;
  total_work_min: number;
  total_travel_min: number;
}

export interface UnassignedTask {
  task_id: string;
  address: string;
  reason: string;
  priority: string;
}

export interface Metrics {
  baseline_engineers: number;
  baseline_mileage: number;
  optimized_engineers: number;
  optimized_mileage: number;
  assigned_count: number;
  unassigned_count: number;
  mileage_reduction_pct?: number | null;
  engineers_reduction_pct?: number | null;
}

export interface StateResponse {
  dispatcher_id: string;
  active_preset: string;
  engineers: Engineer[];
  tasks: Task[];
  schedule: EngineerRoute[];
  metrics?: Metrics | null;
  unassigned_tasks: UnassignedTask[];
}

export interface ExplanationResponse {
  task_id: string;
  assigned_engineer_id?: string | null;
  explanation: string;
  cached: boolean;
}

export interface ChangeEvent {
  event_type: 'URGENT_TASK' | 'CANCEL_TASK' | 'ENGINEER_UNAVAILABLE';
  timestamp?: string;
  task?: Partial<Task>;
  task_id?: string;
  engineer_id?: string;
}

export type FocusTargetType = 'none' | 'task' | 'engineer_route' | 'travel_segment';

export interface TravelSegmentFocus {
  from: [number, number];       // [lon, lat]
  to: [number, number];         // [lon, lat]
  fromTitle?: string;
  toTitle?: string;
  engineerId?: string;
  engineerName?: string;
  travelMin?: number;
  travelKm?: number;
}

export interface MapFocusState {
  type: FocusTargetType;
  taskId?: string | null;
  engineerId?: string | null;
  segment?: TravelSegmentFocus | null;
  nonce?: number;
}

export const createNoneFocus = (): MapFocusState => ({
  type: 'none',
  taskId: null,
  engineerId: null,
  segment: null,
  nonce: Date.now()
});

export const createTaskFocus = (taskId: string): MapFocusState => ({
  type: 'task',
  taskId,
  engineerId: null,
  segment: null,
  nonce: Date.now() + Math.random()
});

export const createEngineerFocus = (engineerId: string): MapFocusState => ({
  type: 'engineer_route',
  engineerId,
  taskId: null,
  segment: null,
  nonce: Date.now() + Math.random()
});

export const createSegmentFocus = (segment: TravelSegmentFocus): MapFocusState => ({
  type: 'travel_segment',
  segment,
  taskId: null,
  engineerId: segment.engineerId || null,
  nonce: Date.now() + Math.random()
});

export const isTaskFocused = (focus?: MapFocusState | null, taskId?: string | null): boolean =>
  Boolean(focus && focus.type === 'task' && taskId && focus.taskId === taskId);

export const isEngineerFocused = (focus?: MapFocusState | null, engineerId?: string | null): boolean =>
  Boolean(focus && focus.type === 'engineer_route' && engineerId && focus.engineerId === engineerId);

export const isSegmentFocused = (focus?: MapFocusState | null): boolean =>
  Boolean(focus && focus.type === 'travel_segment' && focus.segment);

