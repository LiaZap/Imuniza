import { cookies } from 'next/headers';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const store = await cookies();
  const cookieHeader = store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    cache: 'no-store',
  });
}

export async function apiGet<T>(path: string): Promise<T | null> {
  const res = await apiFetch(path);
  if (!res.ok) return null;
  return (await res.json()) as T;
}
