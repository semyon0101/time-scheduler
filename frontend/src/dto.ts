// Flat DTO types representing raw backend responses and requests (pure primitives: string, number, boolean)

export interface RawPositionDTO {
  address?: string;
  lat?: number;
  lon?: number;
  start_lat?: number;
  start_lon?: number;
}

export interface RawEngineerDTO {
  id: string;
  name: string;
  start_lat?: number;
  start_lon?: number;
  shift_start: string;
  shift_end: string;
  skills: string[];
  transport_type: string;
  status?: string;
}

export interface RawTaskDTO {
  id: string;
  address?: string;
  district?: string;
  lat?: number;
  lon?: number;
  window_start: string;
  window_end: string;
  duration_min: number;
  required_skill: string;
  required_transport?: string | null;
  priority: string;
  status?: string;
  control_assigned_engineer?: string | null;
}

export interface RawScheduleStopDTO {
  task_id: string;
  address?: string;
  district?: string;
  lat?: number;
  lon?: number;
  order: number;
  arrival_time: string;
  start_time: string;
  end_time: string;
  travel_km: number;
  travel_min: number;
  required_skill: string;
  priority: string;
}

export interface RawEngineerRouteDTO {
  engineer_id: string;
  engineer_name: string;
  transport_type: string;
  skills: string[];
  start_lat?: number;
  start_lon?: number;
  shift_start: string;
  shift_end: string;
  stops: RawScheduleStopDTO[];
  total_distance_km: number;
  total_work_min: number;
  total_travel_min: number;
}

export interface RawUnassignedTaskDTO {
  task_id: string;
  address?: string;
  reason: string;
  priority: string;
}

export interface RawMetricsDTO {
  baseline_engineers: number;
  baseline_mileage: number;
  optimized_engineers: number;
  optimized_mileage: number;
  assigned_count: number;
  unassigned_count: number;
  mileage_reduction_pct?: number | null;
  engineers_reduction_pct?: number | null;
}

export interface RawStateResponseDTO {
  dispatcher_id: string;
  active_preset: string;
  engineers: RawEngineerDTO[];
  tasks: RawTaskDTO[];
  schedule: RawEngineerRouteDTO[];
  metrics?: RawMetricsDTO | null;
  unassigned_tasks: RawUnassignedTaskDTO[];
}
