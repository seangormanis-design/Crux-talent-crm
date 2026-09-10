import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, setAuthToken, loadAuthToken } from "../api/client";

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuthToken();
    api
      .get<AuthUser>("/api/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { token, user } = await api.post<{ token: string; user: AuthUser }>("/api/auth/login", {
      email,
      password,
    });
    setAuthToken(token);
    setUser(user);
  }

  async function register(email: string, password: string, name: string) {
    const { token, user } = await api.post<{ token: string; user: AuthUser }>("/api/auth/register", {
      email,
      password,
      name,
    });
    setAuthToken(token);
    setUser(user);
  }

  async function logout() {
    await api.post("/api/auth/logout");
    setAuthToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
