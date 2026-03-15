/**
 * Central API client for Nautilus Web Interface
 * Reads base URL from config and handles auth headers
 */
import { API_CONFIG } from '../config';

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
  body?: unknown
): Promise<T> {
  const url = `${API_CONFIG.NAUTILUS_API_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export default api;
