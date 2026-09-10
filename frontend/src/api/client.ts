export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem("crux_token", token);
  else localStorage.removeItem("crux_token");
}

export function loadAuthToken() {
  authToken = localStorage.getItem("crux_token");
  return authToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Raw fetch (no JSON assumption) — for endpoints whose response could be a
// binary file (PDF) or JSON (converted-doc HTML) depending on what's being
// previewed, where the caller needs to inspect the actual Content-Type
// rather than have this client guess it up front.
async function requestRaw(path: string): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  getRaw: requestRaw,
};
