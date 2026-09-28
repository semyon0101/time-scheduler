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
  area_id?: string;
  is_on_duty?: boolean;
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
  category?: 'emergency' | 'connection' | 'repair' | 'add_on' | 'other';
  area_id?: string;
  created_at?: string | null;
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
  unassigned_emergencies?: number;
  unassigned_connections?: number;
  late_emergencies?: number;
  emergency_excess_min?: number;
  emergency_response_min?: number;
  measured_emergencies?: number;
  target_met_emergencies?: number;
  reassigned_tasks?: number;
  shifted_start_min?: number;
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
