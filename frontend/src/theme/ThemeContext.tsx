import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_THEME_ID } from "./themes";

const THEME_KEY = "pepper_theme";

interface ThemeContextValue {
  themeId: string;
  setThemeId: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState(
    () => localStorage.getItem(THEME_KEY) || DEFAULT_THEME_ID
  );

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
