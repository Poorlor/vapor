export async function api<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...options, signal: options.signal ?? AbortSignal.timeout(30000) });
  const data = await response.json();
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || `Ошибка сервера (${response.status})`);
  }
  return data as T;
}

export function post<T = any>(url: string, body?: unknown): Promise<T> {
  return api<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}
