import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_LIGHT_THEME_ID, DEFAULT_THEME_ID } from "./themes";

const THEME_KEY = "pepper_theme";

interface ThemeContextValue {
  themeId: string;
  setThemeId: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialThemeId(): string {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored) return stored;
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  return prefersLight ? DEFAULT_LIGHT_THEME_ID : DEFAULT_THEME_ID;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState(getInitialThemeId);

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
  }, [themeId]);

  function setThemeId(id: string) {
    localStorage.setItem(THEME_KEY, id);
    setThemeIdState(id);
  }

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
