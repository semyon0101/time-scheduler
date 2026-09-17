import { StateResponse, Engineer, Task, ChangeEvent, ExplanationResponse } from './types';

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return '/api/v1';
};

export function getDispatcherId(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session');
    if (sessionParam && sessionParam.trim()) {
      const cleanId = sessionParam.trim();
      localStorage.setItem('beeline_dispatcher_id', cleanId);
      document.cookie = `beeline_dispatcher_id=${cleanId}; path=/; max-age=2592000; SameSite=Lax`;
      return cleanId;
    }
  }

  let id = typeof localStorage !== 'undefined' ? localStorage.getItem('beeline_dispatcher_id') : null;
  if (!id && typeof document !== 'undefined') {
    const match = document.cookie.match(/beeline_dispatcher_id=([^;]+)/);
    if (match && match[1]) {
      id = match[1].trim();
    }
  }

  if (!id) {
    id = `disp_${Math.random().toString(36).substring(2, 9)}`;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('beeline_dispatcher_id', id);
    }
    if (typeof document !== 'undefined') {
      document.cookie = `beeline_dispatcher_id=${id}; path=/; max-age=2592000; SameSite=Lax`;
    }
  }

  // Ensure URL also has ?session=id for transparency & easy sharing
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    if (url.searchParams.get('session') !== id) {
      url.searchParams.set('session', id);
      window.history.replaceState({}, '', url.toString());
    }
  }

  return id;
}

export function setDispatcherId(newId: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('beeline_dispatcher_id', newId);
  }
  if (typeof document !== 'undefined') {
    document.cookie = `beeline_dispatcher_id=${newId}; path=/; max-age=2592000; SameSite=Lax`;
  }
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    url.searchParams.set('session', newId);
    window.history.replaceState({}, '', url.toString());
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const dispId = getDispatcherId();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Dispatcher-Id': dispId,
    ...(options.headers || {})
  };

  const primaryBase = getBaseUrl();
  const candidateBases = [
    primaryBase,
    '/api/v1',
    'http://127.0.0.1:8000/api/v1',
    'http://localhost:8000/api/v1'
  ];

  let lastError: any = null;

  for (const base of candidateBases) {
    try {
      const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const url = `${cleanBase}${cleanEndpoint}`;

      const res = await fetch(url, {
        ...options,
        headers
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP error ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (err) {
      lastError = err;
      if (err instanceof TypeError && err.message.includes('fetch')) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('Не удалось подключиться к серверу API');
}

export const api = {
  async initSession(): Promise<StateResponse> {
    return request<StateResponse>('/session/init');
  },

  async getState(): Promise<StateResponse> {
    return request<StateResponse>('/state');
  },

  async loadPreset(preset: string): Promise<StateResponse> {
    return request<StateResponse>('/demo/seed', {
      method: 'POST',
      body: JSON.stringify({ preset })
    });
  },

  async createEngineer(engineer: Partial<Engineer>): Promise<Engineer> {
    return request<Engineer>('/engineers', {
      method: 'POST',
      body: JSON.stringify(engineer)
    });
  },

  async deleteEngineer(engineerId: string): Promise<void> {
    return request<void>(`/engineers/${engineerId}`, {
      method: 'DELETE'
    });
  },

  async createTask(task: Partial<Task>): Promise<Task> {
    return request<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(task)
    });
  },

  async deleteTask(taskId: string): Promise<void> {
    return request<void>(`/tasks/${taskId}`, {
      method: 'DELETE'
    });
  },

  async cancelTask(taskId: string): Promise<StateResponse> {
    return request<StateResponse>(`/tasks/${taskId}/cancel`, {
      method: 'POST'
    });
  },

  async optimize(): Promise<StateResponse> {
    return request<StateResponse>('/schedule/optimize', {
      method: 'POST'
    });
  },

  async replan(events: ChangeEvent[]): Promise<StateResponse> {
    return request<StateResponse>('/schedule/replan', {
      method: 'POST',
      body: JSON.stringify({ events })
    });
  },

  async getExplanation(taskId: string): Promise<ExplanationResponse> {
    return request<ExplanationResponse>(`/tasks/${taskId}/explanation`);
  },

  async getEngineerExplanation(engineerId: string): Promise<ExplanationResponse> {
    return request<ExplanationResponse>(`/engineers/${engineerId}/explanation`);
  },

  async toggleEngineerStatus(engineerId: string): Promise<StateResponse> {
    return request<StateResponse>(`/engineers/${engineerId}/toggle_status`, {
      method: 'POST'
    });
  },

  async resetSession(): Promise<StateResponse> {
    return request<StateResponse>('/session/reset', {
      method: 'POST'
    });
  }
};
