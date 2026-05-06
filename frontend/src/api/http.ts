export const API_BASE =
  import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

/** GET publico sin Authorization (formularios compartidos). */
export async function apiPublic<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j: { message?: string | string[] } = await res.json();
      if (Array.isArray(j.message)) {
        msg = j.message.join(', ');
      } else if (typeof j.message === 'string') {
        msg = j.message;
      }
    } catch {
      /* */
    }
    throw new Error(msg);
  }
  const text = await res.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

/** POST/PUT público JSON (p. ej. recuperación de contraseña). Sin Authorization. */
export async function apiPublicJson<T>(
  path: string,
  init: RequestInit & { method?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Accept', 'application/json');
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j: { message?: string | string[] } = await res.json();
      if (Array.isArray(j.message)) {
        msg = j.message.join(', ');
      } else if (typeof j.message === 'string') {
        msg = j.message;
      }
    } catch {
      /* */
    }
    throw new Error(msg);
  }
  const text = await res.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

const ACCESS_KEY = 'jikko_token';
const REFRESH_KEY = 'jikko_refresh_token';

let refreshMutex: Promise<boolean> | null = null;

export function getStoredToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(ACCESS_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_KEY);
  }
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setRefreshToken(token: string | null) {
  if (token) {
    localStorage.setItem(REFRESH_KEY, token);
  } else {
    localStorage.removeItem(REFRESH_KEY);
  }
}

export function clearSession() {
  setStoredToken(null);
  setRefreshToken(null);
}

/** Renueva el access token usando el refresh; devuelve false si no hay sesión válida. */
export async function refreshSession(): Promise<boolean> {
  if (refreshMutex) {
    return refreshMutex;
  }
  refreshMutex = (async () => {
    try {
      const rt = getRefreshToken();
      if (!rt) {
        return false;
      }
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) {
        return false;
      }
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      setStoredToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshMutex = null;
    }
  })();
  return refreshMutex;
}

export async function logoutRequest(): Promise<void> {
  const rt = getRefreshToken();
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rt ? { refreshToken: rt } : {}),
    });
  } catch {
    /* red o CORS: igual limpiamos cliente */
  }
  clearSession();
}

function isAuthRefreshPath(path: string): boolean {
  return path === '/auth/refresh' || path.startsWith('/auth/refresh?');
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const exec = async (): Promise<Response> => {
    const headers = new Headers(init.headers);
    if (!(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    const t = getStoredToken();
    if (t) {
      headers.set('Authorization', `Bearer ${t}`);
    }
    return fetch(`${API_BASE}${path}`, { ...init, headers });
  };

  let res = await exec();

  if (res.status === 401 && path !== '/auth/login' && !isAuthRefreshPath(path)) {
    const renewed = await refreshSession();
    if (renewed) {
      res = await exec();
    }
  }

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j: { message?: string | string[] } = await res.json();
      if (Array.isArray(j.message)) {
        msg = j.message.join(', ');
      } else if (typeof j.message === 'string') {
        msg = j.message;
      }
    } catch {
      /* cuerpo no JSON */
    }
    throw new Error(msg);
  }

  const text = await res.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

/** GET autenticado devolviendo Blob (p. ej. Excel). No parsea JSON. */
export async function apiBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const exec = async (): Promise<Response> => {
    const headers = new Headers(init.headers);
    const t = getStoredToken();
    if (t) {
      headers.set('Authorization', `Bearer ${t}`);
    }
    return fetch(`${API_BASE}${path}`, { ...init, headers });
  };

  let res = await exec();

  if (res.status === 401 && !isAuthRefreshPath(path)) {
    const renewed = await refreshSession();
    if (renewed) {
      res = await exec();
    }
  }

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j: { message?: string | string[] } = await res.json();
      if (Array.isArray(j.message)) {
        msg = j.message.join(', ');
      } else if (typeof j.message === 'string') {
        msg = j.message;
      }
    } catch {
      /* cuerpo no JSON */
    }
    throw new Error(msg);
  }
  return res.blob();
}
