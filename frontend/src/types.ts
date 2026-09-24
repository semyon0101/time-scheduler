export enum TransportTypeEnum {
  PUBLIC = "Общественный транспорт",
  BICYCLE = "Велосипед",
  PEDESTRIAN = "Пешеход",
  CAR = "Автомобиль",
}

export enum EngineerStatusEnum {
  ACTIVE = "active",
  UNAVAILABLE = "unavailable",
  NEW = "new",
}

export enum PriorityEnum {
  NORMAL = "Обычная",
  URGENT = "Срочная",
}

export enum SkillEnum {
  LOCKAL = "Локальные работы",
  EMERGENCY = "Аварийные работы",
  CONNECT = "Работы на подключение и дозаказы",
}

export enum TaskStatusEnum {
  ACTIVE = "active",
  CANCELLED = "cancelled",
  NEW = "new",
}

export enum ChangeEventTypeEnum {
  URGENT_TASK = "URGENT_TASK",
  CANCEL_TASK = "CANCEL_TASK",
  ENGINEER_UNAVAILABLE = "ENGINEER_UNAVAILABLE",
  NEW_TASK = "NEW_TASK",
  NEW_ENGINEER = "NEW_ENGINEER",
}

export interface TransportType {
  transport_type: TransportTypeEnum;
}

export interface EngineerStatus {
  status: EngineerStatusEnum;
}

export interface Time {
  time: string; // "HH:MM"
  hours: number; // 0..23
  minutes: number; // 0..59
  absolute_time: number; // hours * 60 + minutes (0..1439)
}

export interface Skill {
  skill: SkillEnum;
}

export interface Position {
  address: string;
  lat: number;
  lon: number;
}

export interface Priority {
  priority: PriorityEnum;
}

export type Tag =
  | { kind: 'transport'; value: TransportTypeEnum }
  | { kind: 'priority'; value: PriorityEnum }
  | { kind: 'skill'; value: SkillEnum }
  | {
      kind: 'status';
      value:
        | EngineerStatusEnum
        | TaskStatusEnum
        | 'active'
        | 'idle'
        | 'unavailable'
        | 'assigned'
        | 'unassigned'
        | 'cancelled'
        | 'modified';
    };

export type Focus =
  | null
  | { kind: 'engineer'; id: string }
  | { kind: 'task'; id: string }
  | { kind: 'road'; id: string };

export interface Road {
  id: string;
  engineer_id: string;
  task_first_id: string | null;
  task_second_id: string | null;
  from_pos: Position;
  to_pos: Position;
  travel_km: number;
  travel_min: number;
  start_time: Time;
  end_time: Time;
}

export interface Engineer {
  id: string;
  name: string;
  position: Position;
  shift_start: Time;
  shift_end: Time;
  skills: SkillEnum[];
  transport_type: TransportTypeEnum;
  status?: EngineerStatusEnum;
  tags: Tag[];
  tasks: string[]; // строго массив идентификаторов задач (task.id)
  roads: string[]; // строго массив идентификаторов дорог (road.id)
}

export interface Task {
  id: string;
  position: Position;
  district?: string;
  window_start: Time;
  window_end: Time;
  duration_time: Time;
  required_skill: SkillEnum;
  required_transport?: TransportTypeEnum | null;
  priority: PriorityEnum;
  status?: TaskStatusEnum;
  tags: Tag[];
  engineer_id: string | null;
  control_assigned_engineer?: string | null;
}

export interface ScheduleStop {
  task_id: string;
  position: Position;
  district?: string;
  order: number;
  arrival_time: Time;
  start_time: Time;
  end_time: Time;
  travel_km: number;
  travel_min: number;
  required_skill: SkillEnum;
  priority: PriorityEnum;
}

export interface EngineerRoute {
  engineer_id: string;
  engineer_name: string;
  transport_type: TransportTypeEnum;
  skills: SkillEnum[];
  start_position: Position;
  shift_start: Time;
  shift_end: Time;
  stops: ScheduleStop[];
  total_distance_km: number;
  total_work_min: number;
  total_travel_min: number;
}

export interface UnassignedTask {
  task_id: string;
  address: string;
  reason: string;
  priority: PriorityEnum;
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
  roads: Road[];
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
  event_type: ChangeEventTypeEnum;
  timestamp?: Time;
  task?: Partial<Task>;
  task_id?: string;
  engineer_id?: string;
}
