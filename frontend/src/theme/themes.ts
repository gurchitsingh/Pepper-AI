export interface ThemeColors {
  bg: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentContrast: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
}

export const THEMES: Theme[] = [
  {
    id: "dark",
    name: "Dark",
    colors: {
      bg: "#121212",
      surface: "#201C1A",
      textPrimary: "#F2EEE9",
      textSecondary: "#A39C93",
      accent: "#F08A3C",
      accentContrast: "#171310",
    },
  },
  {
    id: "light",
    name: "Light",
    colors: {
      bg: "#F7F3E9",
      surface: "#FFFFFF",
      textPrimary: "#1E2A1E",
      textSecondary: "#6E7A6A",
      accent: "#2F5233",
      accentContrast: "#FFFFFF",
    },
  },
];

export const DEFAULT_THEME_ID = "dark";
export const DEFAULT_LIGHT_THEME_ID = "light";
