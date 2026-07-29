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
    id: "default",
    name: "Orange & Black",
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
    id: "indigo",
    name: "Muted Indigo",
    colors: {
      bg: "#14161F",
      surface: "#1E212C",
      textPrimary: "#E7E9F0",
      textSecondary: "#8C90A3",
      accent: "#5B63A8",
      accentContrast: "#FFFFFF",
    },
  },
  {
    id: "charcoal",
    name: "Charcoal & Electric Blue",
    colors: {
      bg: "#16181C",
      surface: "#202329",
      textPrimary: "#EDEEF0",
      textSecondary: "#8C9099",
      accent: "#4F8FF0",
      accentContrast: "#FFFFFF",
    },
  },
  {
    id: "plum",
    name: "Deep Plum & Rose",
    colors: {
      bg: "#201621",
      surface: "#2B1E2C",
      textPrimary: "#F2E9EC",
      textSecondary: "#A08C9E",
      accent: "#D9899E",
      accentContrast: "#2B1E2C",
    },
  },
  {
    id: "cream",
    name: "Warm Cream & Forest",
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

export const DEFAULT_THEME_ID = "default";
export const DEFAULT_LIGHT_THEME_ID = "cream";
