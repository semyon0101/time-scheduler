import {
  Time,
  Position,
  TransportTypeEnum,
  EngineerStatusEnum,
  PriorityEnum,
  SkillEnum,
  TaskStatusEnum,
  ChangeEventTypeEnum,
  Engineer,
  Task,
  Road,
  Tag,
  ScheduleStop,
  EngineerRoute,
  UnassignedTask,
  StateResponse,
  ChangeEvent
} from '../types';
import {
  RawEngineerDTO,
  RawTaskDTO,
  RawScheduleStopDTO,
  RawEngineerRouteDTO,
  RawUnassignedTaskDTO,
  RawStateResponseDTO
} from '../dto';
import { dataStore } from './DataStore';

/**
 * Парсер строки времени («ЧЧ:ММ») в объект Time.
 * Рассчитывает часы, минуты и абсолютные минуты от полуночи.
 */
export function parseTime(timeStr?: string | Time | null): Time {
  if (!timeStr) {
    return {
      time: "00:00",
      hours: 0,
      minutes: 0,
      absolute_time: 0
    };
  }

  if (typeof timeStr === 'object' && 'time' in timeStr && typeof timeStr.time === 'string') {
    return timeStr as Time;
  }

  const str = String(timeStr).trim();
  const parts = str.split(':');
  const h = parts.length > 0 ? parseInt(parts[0], 10) : 0;
  const m = parts.length > 1 ? parseInt(parts[1], 10) : 0;

  const validH = isNaN(h) ? 0 : Math.max(0, Math.min(23, h));
  const validM = isNaN(m) ? 0 : Math.max(0, Math.min(59, m));
  const formatted = `${String(validH).padStart(2, '0')}:${String(validM).padStart(2, '0')}`;

  return {
    time: formatted,
    hours: validH,
    minutes: validM,
    absolute_time: validH * 60 + validM
  };
}

/**
 * Конвертер числа минут в структуру Time.
 * Часы = целочисленное деление на 60, минуты = остаток, absolute_time = минуты.
 */
export function durationMinutesToTime(durationMin?: number | Time | null): Time {
  if (!durationMin) {
    return {
      time: "00:00",
      hours: 0,
      minutes: 0,
      absolute_time: 0
    };
  }

  if (typeof durationMin === 'object' && 'time' in durationMin) {
    return durationMin as Time;
  }

  const totalMin = Math.max(0, Math.round(Number(durationMin) || 0));
  const hours = Math.min(23, Math.floor(totalMin / 60));
  const minutes = totalMin % 60;
  const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  return {
    time: formatted,
    hours,
    minutes,
    absolute_time: totalMin
  };
}

/**
 * Фабрика / конструктор Position.
 */
export function createPosition(address?: string, lat?: number, lon?: number): Position {
  return {
    address: address || '',
    lat: typeof lat === 'number' && !isNaN(lat) ? lat : 0,
    lon: typeof lon === 'number' && !isNaN(lon) ? lon : 0
  };
}

/**
 * Нормализаторы значений перечислений
 */
export function normalizePriority(val?: string | PriorityEnum): PriorityEnum {
  if (val === PriorityEnum.URGENT || val === 'Срочная') {
    return PriorityEnum.URGENT;
  }
  return PriorityEnum.NORMAL;
}

export function normalizeEngineerStatus(val?: string | EngineerStatusEnum): EngineerStatusEnum {
  if (val === EngineerStatusEnum.UNAVAILABLE || val === 'unavailable') {
    return EngineerStatusEnum.UNAVAILABLE;
  }
  if (val === EngineerStatusEnum.NEW || val === 'new') {
    return EngineerStatusEnum.NEW;
  }
  return EngineerStatusEnum.ACTIVE;
}

export function normalizeTaskStatus(val?: string | TaskStatusEnum): TaskStatusEnum {
  if (val === TaskStatusEnum.CANCELLED || val === 'cancelled') {
    return TaskStatusEnum.CANCELLED;
  }
  if (val === TaskStatusEnum.NEW || val === 'new') {
    return TaskStatusEnum.NEW;
  }
  return TaskStatusEnum.ACTIVE;
}

export function normalizeChangeEventType(val?: string | ChangeEventTypeEnum): ChangeEventTypeEnum {
  switch (val) {
    case ChangeEventTypeEnum.CANCEL_TASK:
      return ChangeEventTypeEnum.CANCEL_TASK;
    case ChangeEventTypeEnum.ENGINEER_UNAVAILABLE:
      return ChangeEventTypeEnum.ENGINEER_UNAVAILABLE;
    case ChangeEventTypeEnum.URGENT_TASK:
    default:
      return ChangeEventTypeEnum.URGENT_TASK;
  }
}

export function normalizeTransportType(val?: string | TransportTypeEnum | null): TransportTypeEnum {
  switch (val) {
    case TransportTypeEnum.BICYCLE:
    case 'Велосипед':
      return TransportTypeEnum.BICYCLE;
    case TransportTypeEnum.PEDESTRIAN:
    case 'Пешеход':
      return TransportTypeEnum.PEDESTRIAN;
    case TransportTypeEnum.PUBLIC:
    case 'Общественный транспорт':
      return TransportTypeEnum.PUBLIC;
    case TransportTypeEnum.CAR:
    case 'Автомобиль':
    default:
      return TransportTypeEnum.CAR;
  }
}

export function normalizeSkill(val?: string | SkillEnum): SkillEnum {
  switch (val) {
    case SkillEnum.EMERGENCY:
    case 'Аварийные работы':
      return SkillEnum.EMERGENCY;
    case SkillEnum.CONNECT:
    case 'Работы на подключение и дозаказы':
      return SkillEnum.CONNECT;
    case SkillEnum.LOCKAL:
    case 'Локальные работы':
    default:
      return SkillEnum.LOCKAL;
  }
}

export function computeTaskTags(task: {
  required_transport?: TransportTypeEnum | null;
  required_skill: SkillEnum;
  priority: PriorityEnum;
  status?: TaskStatusEnum;
}): Tag[] {
  const tags: Tag[] = [];
  if (task.required_transport) {
    tags.push({ kind: 'transport', value: task.required_transport });
  }
  if (task.required_skill) {
    tags.push({ kind: 'skill', value: task.required_skill });
  }
  if (task.priority) {
    tags.push({ kind: 'priority', value: task.priority });
  }
  if (task.status) {
    tags.push({ kind: 'status', value: task.status });
  }
  return tags;
}

export function computeEngineerTags(engineer: {
  transport_type: TransportTypeEnum;
  skills: SkillEnum[];
  status?: EngineerStatusEnum;
  tasksCount?: number;
}): Tag[] {
  const tags: Tag[] = [];
  if (engineer.transport_type) {
    tags.push({ kind: 'transport', value: engineer.transport_type });
  }
  if (engineer.skills) {
    for (let i = 0; i < engineer.skills.length; i++) {
      tags.push({ kind: 'skill', value: engineer.skills[i] });
    }
  }
  if (engineer.status) {
    tags.push({ kind: 'status', value: engineer.status });
  }
  return tags;
}

export function normalizeEngineer(dto: RawEngineerDTO): Engineer {
  const pos = createPosition('', dto.start_lat, dto.start_lon);
  const transport = normalizeTransportType(dto.transport_type);
  const skills = (dto.skills || []).map(normalizeSkill);
  const status = dto.status ? normalizeEngineerStatus(dto.status) : undefined;

  const engObj: Engineer = {
    id: dto.id,
    name: dto.name,
    position: pos,
    shift_start: parseTime(dto.shift_start),
    shift_end: parseTime(dto.shift_end),
    skills,
    transport_type: transport,
    status,
    tags: [],
    tasks: [],
    roads: []
  };
  engObj.tags = computeEngineerTags({
    transport_type: transport,
    skills,
    status,
    tasksCount: 0
  });
  return engObj;
}

export function normalizeTask(dto: RawTaskDTO): Task {
  const pos = createPosition(dto.address, dto.lat, dto.lon);
  const priority = normalizePriority(dto.priority);
  const skill = normalizeSkill(dto.required_skill);
  const transport = dto.required_transport ? normalizeTransportType(dto.required_transport) : null;
  const status = dto.status ? normalizeTaskStatus(dto.status) : TaskStatusEnum.ACTIVE;

  const taskObj: Task = {
    id: dto.id,
    position: pos,
    district: dto.district,
    window_start: parseTime(dto.window_start),
    window_end: parseTime(dto.window_end),
    duration_time: durationMinutesToTime(dto.duration_min),
    required_skill: skill,
    required_transport: transport,
    priority,
    status,
    tags: [],
    engineer_id: dto.control_assigned_engineer || null,
    control_assigned_engineer: dto.control_assigned_engineer
  };
  taskObj.tags = computeTaskTags(taskObj);
  return taskObj;
}

export function normalizeScheduleStop(dto: RawScheduleStopDTO): ScheduleStop {
  const pos = createPosition(dto.address, dto.lat, dto.lon);
  return {
    task_id: dto.task_id,
    position: pos,
    district: dto.district,
    order: dto.order,
    arrival_time: parseTime(dto.arrival_time),
    start_time: parseTime(dto.start_time),
    end_time: parseTime(dto.end_time),
    travel_km: dto.travel_km || 0,
    travel_min: dto.travel_min || 0,
    required_skill: normalizeSkill(dto.required_skill),
    priority: normalizePriority(dto.priority)
  };
}

export function normalizeEngineerRoute(dto: RawEngineerRouteDTO): EngineerRoute {
  const startPos = createPosition('', dto.start_lat, dto.start_lon);
  return {
    engineer_id: dto.engineer_id,
    engineer_name: dto.engineer_name,
    transport_type: normalizeTransportType(dto.transport_type),
    skills: (dto.skills || []).map(normalizeSkill),
    start_position: startPos,
    shift_start: parseTime(dto.shift_start),
    shift_end: parseTime(dto.shift_end),
    stops: (dto.stops || []).map(normalizeScheduleStop),
    total_distance_km: dto.total_distance_km || 0,
    total_work_min: dto.total_work_min || 0,
    total_travel_min: dto.total_travel_min || 0
  };
}

export function normalizeUnassignedTask(dto: RawUnassignedTaskDTO): UnassignedTask {
  return {
    task_id: dto.task_id,
    address: dto.address || '',
    reason: dto.reason || '',
    priority: normalizePriority(dto.priority)
  };
}

export function normalizeStateResponse(dto: RawStateResponseDTO): StateResponse {
  // Step 1 (O(T)): Normalize tasks and index in Map
  const rawTasks = dto.tasks || [];
  const tasks: Task[] = new Array(rawTasks.length);
  const taskMap = new Map<string, Task>();
  for (let i = 0; i < rawTasks.length; i++) {
    const t = normalizeTask(rawTasks[i]);
    tasks[i] = t;
    taskMap.set(t.id, t);
  }

  // Step 2 (O(R)): Normalize schedule routes and build Road segments
  const rawRoutes = dto.schedule || [];
  const schedule: EngineerRoute[] = new Array(rawRoutes.length);
  const allRoads: Road[] = [];
  const engineerRoadIdsMap = new Map<string, string[]>();
  const engineerTaskIdsMap = new Map<string, string[]>();

  for (let i = 0; i < rawRoutes.length; i++) {
    const rDto = rawRoutes[i];
    const normRoute = normalizeEngineerRoute(rDto);
    schedule[i] = normRoute;

    const routeRoadIds: string[] = [];
    const routeTaskIds: string[] = [];

    let prevPos = normRoute.start_position;
    let prevTaskId: string | null = null;

    for (let sIdx = 0; sIdx < normRoute.stops.length; sIdx++) {
      const stop = normRoute.stops[sIdx];
      const roadId = `road_${normRoute.engineer_id}_${sIdx}_${stop.task_id}`;

      const travelMin = stop.travel_min || 0;
      const arrivalMin = stop.arrival_time ? stop.arrival_time.absolute_time : stop.start_time.absolute_time;
      const depMin = Math.max(0, arrivalMin - travelMin);

      const road: Road = {
        id: roadId,
        engineer_id: normRoute.engineer_id,
        task_first_id: prevTaskId,
        task_second_id: stop.task_id,
        from_pos: prevPos,
        to_pos: stop.position,
        travel_km: stop.travel_km || 0,
        travel_min: travelMin,
        start_time: durationMinutesToTime(depMin),
        end_time: stop.arrival_time || stop.start_time,
      };

      allRoads.push(road);
      routeRoadIds.push(roadId);

      // Link task to this engineer and recompute tags
      if (stop.task_id) {
        routeTaskIds.push(stop.task_id);
        const t = taskMap.get(stop.task_id);
        if (t) {
          t.engineer_id = normRoute.engineer_id;
        }
      }

      prevPos = stop.position;
      prevTaskId = stop.task_id;
    }

    engineerRoadIdsMap.set(normRoute.engineer_id, routeRoadIds);
    engineerTaskIdsMap.set(normRoute.engineer_id, routeTaskIds);
  }

  // Step 3 (O(E)): Normalize engineers and bind tasks and roads strictly by IDs
  const rawEngineers = dto.engineers || [];
  const engineers: Engineer[] = new Array(rawEngineers.length);
  for (let i = 0; i < rawEngineers.length; i++) {
    const eng = normalizeEngineer(rawEngineers[i]);
    const taskIds = engineerTaskIdsMap.get(eng.id) || [];
    const roadIds = engineerRoadIdsMap.get(eng.id) || [];

    eng.tasks = taskIds;
    eng.roads = roadIds;
    eng.tags = computeEngineerTags({
      transport_type: eng.transport_type,
      skills: eng.skills,
      status: eng.status,
      tasksCount: taskIds.length,
    });

    engineers[i] = eng;
  }

  // Step 4: Populate DataStore in O(N)
  dataStore.set(engineers, tasks, allRoads);

  return {
    dispatcher_id: dto.dispatcher_id,
    active_preset: dto.active_preset,
    engineers,
    tasks,
    roads: allRoads,
    schedule,
    metrics: dto.metrics || null,
    unassigned_tasks: (dto.unassigned_tasks || []).map(normalizeUnassignedTask)
  };
}

/**
 * Обратные сериализаторы для исходящих запросов к бэкенду.
 * Преобразуют доменные сущности с Time и Position в плоский формат DTO бэкенда.
 */
export function serializeEngineerForBackend(eng: Partial<Engineer> & Record<string, any>): Record<string, any> {
  const result: Record<string, any> = { ...eng };

  if (eng.position) {
    result.start_lat = eng.position.lat;
    result.start_lon = eng.position.lon;
    delete result.position;
  }
  if (eng.shift_start) {
    result.shift_start = typeof eng.shift_start === 'object' ? eng.shift_start.time : eng.shift_start;
  }
  if (eng.shift_end) {
    result.shift_end = typeof eng.shift_end === 'object' ? eng.shift_end.time : eng.shift_end;
  }
  delete result.tasks;
  delete result.roads;
  delete result.routes;
  delete result.tags;
  return result;
}

export function serializeTaskForBackend(task: Partial<Task> & Record<string, any>): Record<string, any> {
  const result: Record<string, any> = { ...task };

  if (task.position) {
    result.address = task.position.address;
    result.lat = task.position.lat;
    result.lon = task.position.lon;
    delete result.position;
  }
  if (task.window_start) {
    result.window_start = typeof task.window_start === 'object' ? task.window_start.time : task.window_start;
  }
  if (task.window_end) {
    result.window_end = typeof task.window_end === 'object' ? task.window_end.time : task.window_end;
  }
  if (task.duration_time) {
    result.duration_min = typeof task.duration_time === 'object' ? task.duration_time.absolute_time : task.duration_time;
    delete result.duration_time;
  }
  delete result.tags;
  delete result.engineer_id;
  return result;
}

export function serializeChangeEventForBackend(event: ChangeEvent): Record<string, any> {
  const result: Record<string, any> = {
    event_type: event.event_type,
    task_id: event.task_id,
    engineer_id: event.engineer_id
  };

  if (event.timestamp) {
    result.timestamp = typeof event.timestamp === 'object' ? event.timestamp.time : event.timestamp;
  }

  if (event.task) {
    result.task = serializeTaskForBackend(event.task);
  }

  return result;
}
