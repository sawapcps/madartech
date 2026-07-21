/*
 * Frontend API Client
 * Used by dashboard pages to communicate with our backend API routes.
 * No Supabase — just fetch calls to our own Next.js API routes.
 */

// ✅ إضافة دالة مساعدة للتحقق من 401
function handleUnauthorized() {
  if (typeof window !== 'undefined') {
    // إذا كان المستخدم غير موثّق، توجه إلى صفحة تسجيل الدخول
    window.location.href = '/login';
  }
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include', // ✅ إرسال الكوكيز مع الطلب
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  // ✅ معالجة 401
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized - Please login again');
  }
  
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return data.data as T;
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include', // ✅ إرسال الكوكيز مع الطلب
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  // ✅ معالجة 401
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized - Please login again');
  }
  
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return (data.data ?? data) as T;
}

export async function apiPut<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PUT',
    credentials: 'include', // ✅ إرسال الكوكيز مع الطلب
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  // ✅ معالجة 401
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized - Please login again');
  }
  
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return (data.data ?? data) as T;
}

export async function apiPostFull<T = unknown>(path: string, body?: unknown): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include', // ✅ إرسال الكوكيز مع الطلب
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  // ✅ معالجة 401
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized - Please login again');
  }
  
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return { data: data.data, meta: data.meta };
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(path, {
    method: 'DELETE',
    credentials: 'include', // ✅ إرسال الكوكيز مع الطلب
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  // ✅ معالجة 401
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized - Please login again');
  }
  
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
}