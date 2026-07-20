/*
 * Frontend API Client
 * Used by dashboard pages to communicate with our backend API routes.
 * No Supabase — just fetch calls to our own Next.js API routes.
 */

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return data.data as T;
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return (data.data ?? data) as T;
}

// ✅ إضافة دالة PUT
export async function apiPut<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return (data.data ?? data) as T;
}

export async function apiPostFull<T = unknown>(path: string, body?: unknown): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return { data: data.data, meta: data.meta };
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(path, { method: 'DELETE' });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
}