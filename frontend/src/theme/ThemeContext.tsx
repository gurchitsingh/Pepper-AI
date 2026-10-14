import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_LIGHT_THEME_ID, DEFAULT_THEME_ID, THEMES, type ThemeColors } from "./themes";

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

// index.css's `:root` block hardcodes the default (dark) theme's colors so the
// page has correct colors on first paint, before this provider can run. Every
// other theme's CSS variables are set here from `themes.ts`, which is the
// single source of truth for color values, so the two can't drift apart.
function applyThemeColors(colors: ThemeColors) {
  const root = document.documentElement.style;
  root.setProperty("--bg", colors.bg);
  root.setProperty("--surface", colors.surface);
  root.setProperty("--text-primary", colors.textPrimary);
  root.setProperty("--text-secondary", colors.textSecondary);
  root.setProperty("--accent", colors.accent);
  root.setProperty("--accent-contrast", colors.accentContrast);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState(getInitialThemeId);

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
    const theme = THEMES.find((t) => t.id === themeId);
    if (theme) applyThemeColors(theme.colors);
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
