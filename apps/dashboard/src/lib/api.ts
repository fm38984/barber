const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

async function fetcher<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, headers?: Record<string, string>) =>
    fetcher<T>(path, { method: 'GET', headers }),

  post: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    fetcher<T>(path, { method: 'POST', body: JSON.stringify(body), headers }),

  patch: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    fetcher<T>(path, { method: 'PATCH', body: JSON.stringify(body), headers }),

  delete: <T>(path: string, headers?: Record<string, string>) =>
    fetcher<T>(path, { method: 'DELETE', headers }),
};

export function withToken(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
