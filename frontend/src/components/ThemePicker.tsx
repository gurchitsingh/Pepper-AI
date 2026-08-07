import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import { THEMES } from "../theme/themes";

const ICONS: Record<string, typeof Sun> = {
  dark: Moon,
  light: Sun,
};

export function ThemePicker() {
  const { themeId, setThemeId } = useTheme();

  return (
    <div className="grid grid-cols-2 gap-3">
      {THEMES.map((t) => {
        const Icon = ICONS[t.id] ?? Sun;
        const selected = themeId === t.id;
        return (
          <motion.button
            key={t.id}
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => setThemeId(t.id)}
            aria-label={t.name}
            aria-pressed={selected}
            className={`flex items-center justify-center gap-2 h-14 rounded-xl border-2 font-medium transition-colors ${
              selected ? "border-accent" : "border-transparent"
            }`}
            style={{ background: t.colors.bg, color: t.colors.textPrimary }}
          >
            <Icon size={18} style={{ color: t.colors.accent }} />
            {t.name}
          </motion.button>
        );
      })}
    </div>
  );
}
