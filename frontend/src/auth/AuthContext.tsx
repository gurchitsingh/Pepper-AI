import { createContext, useContext, useState, type ReactNode } from "react";
import * as api from "../api/endpoints";
import { getToken, setToken, clearToken } from "../api/client";

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken());

  async function login(email: string, password: string) {
    const token = await api.login(email, password);
    setToken(token.access_token);
    setIsAuthenticated(true);
  }

  async function signup(email: string, password: string, name?: string) {
    const token = await api.signup(email, password, name);
    setToken(token.access_token);
    setIsAuthenticated(true);
  }

  function logout() {
    clearToken();
    setIsAuthenticated(false);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
