const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'Request failed')
  }
  return res.json()
}

export const api = {
  auth: {
    me: () => request<{ id: number; githubLogin: string; avatarUrl: string }>('/api/auth/me'),
  },
  repos: {
    list: () => request<any[]>('/api/repos'),
    add: (fullName: string) =>
      request<any>('/api/repos', { method: 'POST', body: JSON.stringify({ fullName }) }),
    remove: (id: number) => request<void>(`/api/repos/${id}`, { method: 'DELETE' }),
    toggle: (id: number, isActive: boolean) =>
      request<any>(`/api/repos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
  },
  reviews: {
    list: () => request<any[]>('/api/reviews'),
    get: (id: number) => request<any>(`/api/reviews/${id}`),
  },
}
