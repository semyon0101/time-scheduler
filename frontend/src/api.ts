import {
  StateResponse,
  Engineer,
  Task,
  ChangeEvent,
  ExplanationResponse
} from "./types";
import {
  RawStateResponseDTO,
  RawEngineerDTO,
  RawTaskDTO
} from "./dto";
import {
  normalizeStateResponse,
  normalizeEngineer,
  normalizeTask,
  serializeEngineerForBackend,
  serializeTaskForBackend,
  serializeChangeEventForBackend
} from "./utils/adapters";

export function getDispatcherId(): string {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get("session");
    if (sessionParam && sessionParam.trim()) {
      const cleanId = sessionParam.trim();
      localStorage.setItem("beeline_dispatcher_id", cleanId);
      document.cookie = `beeline_dispatcher_id=${cleanId}; path=/; max-age=2592000; SameSite=Lax`;
      return cleanId;
    }
  }

  let id =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("beeline_dispatcher_id")
      : null;
  if (!id && typeof document !== "undefined") {
    const match = document.cookie.match(/beeline_dispatcher_id=([^;]+)/);
    if (match && match[1]) {
      id = match[1].trim();
    }
  }

  if (!id) {
    id = `disp_${Math.random().toString(36).substring(2, 9)}`;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("beeline_dispatcher_id", id);
    }
    if (typeof document !== "undefined") {
      document.cookie = `beeline_dispatcher_id=${id}; path=/; max-age=2592000; SameSite=Lax`;
    }
  }

  // Ensure URL also has ?session=id for transparency & easy sharing
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    if (url.searchParams.get("session") !== id) {
      url.searchParams.set("session", id);
      window.history.replaceState({}, "", url.toString());
    }
  }

  return id;
}

export function setDispatcherId(newId: string): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("beeline_dispatcher_id", newId);
  }
  if (typeof document !== "undefined") {
    document.cookie = `beeline_dispatcher_id=${newId}; path=/; max-age=2592000; SameSite=Lax`;
  }
  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    url.searchParams.set("session", newId);
    window.history.replaceState({}, "", url.toString());
  }
}

async function request<T>(
  endpoint: string,
  method: string = "GET",
  body: BodyInit | null = null,
): Promise<T> {
  const dispId = getDispatcherId();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-Dispatcher-Id": dispId,
  };

  const url = `/api/v1${endpoint}`;

  const res = await fetch(url, {
    method: method,
    body: body,
    headers,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(
      errData.detail || `HTTP error ${res.status}: ${res.statusText}`,
    );
  }

  return await res.json();
}

export const api = {
  async initSession(): Promise<StateResponse> {
    const raw = await request<RawStateResponseDTO>("/session/init");
    return normalizeStateResponse(raw);
  },

  async getState(): Promise<StateResponse> {
    const raw = await request<RawStateResponseDTO>("/state");
    return normalizeStateResponse(raw);
  },

  async loadPreset(preset: string): Promise<StateResponse> {
    const raw = await request<RawStateResponseDTO>(
      "/demo/seed",
      "POST",
      JSON.stringify({ preset }),
    );
    return normalizeStateResponse(raw);
  },

  async createEngineer(engineer: Partial<Engineer>): Promise<Engineer> {
    const payload = serializeEngineerForBackend(engineer);
    const raw = await request<RawEngineerDTO>("/engineers", "POST", JSON.stringify(payload));
    return normalizeEngineer(raw);
  },

  async deleteEngineer(engineerId: string): Promise<void> {
    return request<void>(`/engineers/${engineerId}`, "DELETE");
  },

  async createTask(task: Partial<Task>): Promise<Task> {
    const payload = serializeTaskForBackend(task);
    const raw = await request<RawTaskDTO>("/tasks", "POST", JSON.stringify(payload));
    return normalizeTask(raw);
  },

  async deleteTask(taskId: string): Promise<void> {
    return request<void>(`/tasks/${taskId}`, "DELETE");
  },

  async cancelTask(taskId: string): Promise<StateResponse> {
    const raw = await request<RawStateResponseDTO>(`/tasks/${taskId}/cancel`, "POST");
    return normalizeStateResponse(raw);
  },

  async optimize(): Promise<StateResponse> {
    const raw = await request<RawStateResponseDTO>("/schedule/optimize", "POST");
    return normalizeStateResponse(raw);
  },

  async replan(events: ChangeEvent[]): Promise<StateResponse> {
    const serializedEvents = events.map(serializeChangeEventForBackend);
    const raw = await request<RawStateResponseDTO>(
      "/schedule/replan",
      "POST",
      JSON.stringify({ events: serializedEvents }),
    );
    return normalizeStateResponse(raw);
  },

  async getExplanation(taskId: string): Promise<ExplanationResponse> {
    return request<ExplanationResponse>(`/tasks/${taskId}/explanation`);
  },

  async getEngineerExplanation(
    engineerId: string,
  ): Promise<ExplanationResponse> {
    return request<ExplanationResponse>(`/engineers/${engineerId}/explanation`);
  },

  async toggleEngineerStatus(engineerId: string): Promise<StateResponse> {
    const raw = await request<RawStateResponseDTO>(
      `/engineers/${engineerId}/toggle_status`,
      "POST",
    );
    return normalizeStateResponse(raw);
  },

  async resetSession(): Promise<StateResponse> {
    const raw = await request<RawStateResponseDTO>("/session/reset", "POST");
    return normalizeStateResponse(raw);
  },
};
