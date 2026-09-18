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

// A generous ceiling so a slow-but-legitimate request (a large file upload
// on a poor connection) isn't cut off early, while still guaranteeing every
// request eventually settles instead of hanging forever if the backend gets
// stuck (e.g. a third-party parsing library that hangs instead of throwing)
// — without this, a stuck backend call left the UI showing no error at all.
const DEFAULT_TIMEOUT_MS = 60000;

async function request<T>(path: string, options: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      signal: controller.signal,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...options.headers,
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("The request timed out. Please check your connection and try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body.error === "string" ? body.error : body.error ? JSON.stringify(body.error) : undefined;
    throw new Error(message ?? `Request failed: ${res.status}`);
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
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  getRaw: requestRaw,
};
