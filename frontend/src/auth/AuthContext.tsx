import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as api from "../api/endpoints";
import { getToken, setToken, clearToken } from "../api/client";
import type { Token, UserOut } from "../api/types";

interface AuthContextValue {
  isAuthenticated: boolean;
  user: UserOut | null;
  userLoading: boolean;
  avatarUrl: string | null;
  login: (email: string, password: string) => Promise<Token>;
  signup: (email: string, password: string, username: string, name?: string) => Promise<Token>;
  googleLogin: (idToken: string) => Promise<Token>;
  verifyEmail: (email: string, code: string) => Promise<Token>;
  resendVerificationCode: (email: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setAvatar: (user: UserOut, blob: Blob) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getToken());
  const [user, setUser] = useState<UserOut | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarUrlRef = useRef<string | null>(null);

  function replaceAvatarUrl(next: string | null) {
    if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current);
    avatarUrlRef.current = next;
    setAvatarUrl(next);
  }

  async function refreshUser() {
    const me = await api.getMe();
    setUser(me);
    if (me.has_avatar) {
      const blob = await api.getAvatar();
      replaceAvatarUrl(URL.createObjectURL(blob));
    } else {
      replaceAvatarUrl(null);
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      setUserLoading(true);
      refreshUser()
        .catch(() => {})
        .finally(() => setUserLoading(false));
    } else {
      setUser(null);
      replaceAvatarUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    return () => {
      if (avatarUrlRef.current) URL.revokeObjectURL(avatarUrlRef.current);
    };
  }, []);

  function setAvatar(nextUser: UserOut, blob: Blob) {
    setUser(nextUser);
    replaceAvatarUrl(URL.createObjectURL(blob));
  }

  async function login(email: string, password: string) {
    const token = await api.login(email, password);
    setToken(token.access_token);
    setIsAuthenticated(true);
    return token;
  }

  async function signup(email: string, password: string, username: string, name?: string) {
    const token = await api.signup(email, password, username, name);
    setToken(token.access_token);
    setIsAuthenticated(true);
    return token;
  }

  async function googleLogin(idToken: string) {
    const token = await api.googleLogin(idToken);
    setToken(token.access_token);
    setIsAuthenticated(true);
    return token;
  }

  async function verifyEmail(email: string, code: string) {
    const token = await api.verifyEmail(email, code);
    setToken(token.access_token);
    setIsAuthenticated(true);
    await refreshUser();
    return token;
  }

  async function resendVerificationCode(email: string) {
    await api.resendVerificationCode(email);
  }

  function logout() {
    clearToken();
    setIsAuthenticated(false);
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        userLoading,
        avatarUrl,
        login,
        signup,
        googleLogin,
        verifyEmail,
        resendVerificationCode,
        logout,
        refreshUser,
        setAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
