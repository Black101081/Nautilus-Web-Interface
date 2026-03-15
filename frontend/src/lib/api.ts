/**
 * Central API client for Nautilus Web Interface
 * Handles auth headers, automatic retry with exponential backoff,
 * and structured error objects.
 */
import { API_CONFIG } from '../config';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getAuthHeaders(): Record<string, string> {
  const apiKey = localStorage.getItem('nautilus_api_key');
  if (apiKey) {
    return { 'X-API-Key': apiKey };
  }
  return {};
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retries = 2,
  timeoutMs = API_CONFIG.TIMEOUT,
): Promise<T> {
  const url = `${API_CONFIG.NAUTILUS_API_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  };

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        let detail: string | undefined;
        try {
          detail = JSON.parse(text)?.detail;
        } catch {
          detail = text;
        }
        // 4xx errors are not retried — they indicate client errors
        if (response.status < 500) {
          throw new ApiError(response.status, `HTTP ${response.status}`, detail);
        }
        lastError = new ApiError(response.status, `HTTP ${response.status}`, detail);
      } else {
        return response.json() as Promise<T>;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) throw err;
      lastError = err;
    } finally {
      clearTimeout(timer);
    }

    // Exponential backoff before retry (skip after last attempt)
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }

  throw lastError ?? new Error('Request failed');
}

const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  /** Fire-and-forget: returns null on failure instead of throwing */
  safeGet: async <T>(path: string, fallback: T): Promise<T> => {
    try {
      return await request<T>('GET', path);
    } catch {
      return fallback;
    }
  },
};

export default api;
