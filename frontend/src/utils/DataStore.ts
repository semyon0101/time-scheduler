import { Task, Engineer, Road } from '../types';

/**
 * Единое хранилище данных приложения (DataStore)
 * Предоставляет гарантированный доступ к любой сущности по ID за константное время O(1).
 */
export class Data {
  private tasks: Map<string, Task> = new Map();
  private engineers: Map<string, Engineer> = new Map();
  private roads: Map<string, Road> = new Map();

  /**
   * Возвращает задачу по ID за O(1).
   * Если ID не найден, выбрасывает исключение с понятным текстом ошибки.
   */
  public get_by_id_task(id: string): Task {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task with id "${id}" not found in DataStore`);
    }
    return task;
  }

  /**
   * Возвращает инженера по ID за O(1).
   * Если ID не найден, выбрасывает исключение.
   */
  public get_by_id_engineer(id: string): Engineer {
    const engineer = this.engineers.get(id);
    if (!engineer) {
      throw new Error(`Engineer with id "${id}" not found in DataStore`);
    }
    return engineer;
  }

  /**
   * Возвращает сегмент дороги по ID за O(1).
   * Если ID не найден, выбрасывает исключение.
   */
  public get_by_id_roads(id: string): Road {
    const road = this.roads.get(id);
    if (!road) {
      throw new Error(`Road with id "${id}" not found in DataStore`);
    }
    return road;
  }

  /**
   * Безопасный поиск задачи без выброса исключения
   */
  public find_by_id_task(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  /**
   * Безопасный поиск инженера без выброса исключения
   */
  public find_by_id_engineer(id: string): Engineer | undefined {
    return this.engineers.get(id);
  }

  /**
   * Безопасный поиск дороги без выброса исключения
   */
  public find_by_id_roads(id: string): Road | undefined {
    return this.roads.get(id);
  }

  /**
   * Обновляет задачу по ID. Если такого ID в хэш-таблице нет, выбрасывает исключение.
   */
  public set_by_id_task(id: string, task: Task): void {
    if (!this.tasks.has(id)) {
      throw new Error(`Cannot update: Task with id "${id}" does not exist in DataStore`);
    }
    this.tasks.set(id, task);
  }

  /**
   * Обновляет инженера по ID. Если такого ID в хэш-таблице нет, выбрасывает исключение.
   */
  public set_by_id_engineer(id: string, engineer: Engineer): void {
    if (!this.engineers.has(id)) {
      throw new Error(`Cannot update: Engineer with id "${id}" does not exist in DataStore`);
    }
    this.engineers.set(id, engineer);
  }

  /**
   * Обновляет дорогу по ID. Если такого ID в хэш-таблице нет, выбрасывает исключение.
   */
  public set_by_id_roads(id: string, road: Road): void {
    if (!this.roads.has(id)) {
      throw new Error(`Cannot update: Road with id "${id}" does not exist in DataStore`);
    }
    this.roads.set(id, road);
  }

  /**
   * Добавляет новую задачу в DataStore
   */
  public add_task(task: Task): void {
    this.tasks.set(task.id, task);
  }

  /**
   * Добавляет нового инженера в DataStore
   */
  public add_engineer(engineer: Engineer): void {
    this.engineers.set(engineer.id, engineer);
  }

  /**
   * Добавляет новый сегмент дороги в DataStore
   */
  public add_road(road: Road): void {
    this.roads.set(road.id, road);
  }

  /**
   * Полностью очищает старые хэш-таблицы и наполняет их заново переданными массивами за время O(N).
   * ВНИМАНИЕ: Данный метод разрешено вызывать строго и только внутри фабрики/адаптеров!
   */
  public set(engineers: Engineer[], tasks: Task[], roads: Road[]): void {
    this.engineers.clear();
    this.tasks.clear();
    this.roads.clear();

    for (let i = 0; i < engineers.length; i++) {
      this.engineers.set(engineers[i].id, engineers[i]);
    }
    for (let i = 0; i < tasks.length; i++) {
      this.tasks.set(tasks[i].id, tasks[i]);
    }
    for (let i = 0; i < roads.length; i++) {
      this.roads.set(roads[i].id, roads[i]);
    }
  }

  /**
   * Возвращает массив всех инженеров.
   */
  public get_all_engineers(): Engineer[] {
    return Array.from(this.engineers.values());
  }

  /**
   * Возвращает массив всех задач.
   */
  public get_all_tasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Возвращает массив всех дорог.
   */
  public get_all_roads(): Road[] {
    return Array.from(this.roads.values());
  }
}

/**
 * Единственный глобальный экземпляр хранилища данных
 */
export const dataStore = new Data();

