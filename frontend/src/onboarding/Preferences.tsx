import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";
import { THEMES } from "../theme/themes";

const TOPICS = [
  "Philosophy",
  "AI Ethics",
  "Quantum Physics",
  "Architectural Design",
  "Venture Capital",
  "Stoicism",
  "Neuroscience",
  "Minimalism",
  "Digital Art",
  "Behavioral Economics",
  "Space Exploration",
  "Creative Writing",
  "History of Science",
  "Sustainable Energy",
  "Cybersecurity",
  "Machine Learning",
  "Modern Art",
  "Macroeconomics",
  "Biohacking",
  "Classical Music",
];

const MIN_TOPICS = 3;

export function Preferences() {
  const { themeId, setThemeId } = useTheme();
  const [interests, setInterests] = useState<string[]>([]);
  const navigate = useNavigate();

  const canContinue = interests.length >= MIN_TOPICS;

  function toggleInterest(interest: string) {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }

  function handleContinue() {
    if (!canContinue) return;
    // No backend field for interests yet — captured locally only.
    console.log("Selected interests:", interests);
    navigate("/source");
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="flex items-center justify-between px-4 h-16 shrink-0">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:text-accent transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-heading text-accent text-lg font-semibold">Personalize</h1>
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          aria-label="Continue"
          className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:text-accent disabled:opacity-30 disabled:hover:text-text-secondary transition-colors"
        >
          <Check size={20} />
        </button>
      </header>

      <div className="flex-grow overflow-y-auto px-6 pb-32 max-w-lg mx-auto w-full flex flex-col gap-10">
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-text-primary text-2xl font-semibold">Choose your atmosphere</h2>
          <div className="grid grid-cols-2 gap-3">
            {THEMES.map((t) => {
              const selected = themeId === t.id;
              return (
                <motion.button
                  key={t.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setThemeId(t.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${
                    selected ? "border-accent bg-accent/5" : "border-text-secondary/15 bg-surface"
                  }`}
                >
                  <span
                    className="w-11 h-11 rounded-full flex items-center justify-center"
                    style={{ background: t.colors.accent }}
                  >
                    {selected && <Check size={18} color={t.colors.accentContrast} strokeWidth={3} />}
                  </span>
                  <span className={`text-sm ${selected ? "text-accent" : "text-text-secondary"}`}>{t.name}</span>
                </motion.button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <h2 className="font-heading text-text-primary text-2xl font-semibold">What fuels your mind?</h2>
            <p className="text-text-secondary text-sm mt-1">Select at least {MIN_TOPICS} topics to calibrate your AI.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((topic) => {
              const selected = interests.includes(topic);
              return (
                <button
                  key={topic}
                  onClick={() => toggleInterest(topic)}
                  className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                    selected
                      ? "bg-accent text-accent-contrast border-accent"
                      : "bg-surface text-text-secondary border-text-secondary/20"
                  }`}
                >
                  {topic}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-bg/95 backdrop-blur-md border-t border-text-secondary/10 px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <div className="shrink-0">
            <p className="text-text-primary text-sm font-semibold uppercase tracking-wide">
              {interests.length} topic{interests.length === 1 ? "" : "s"} selected
            </p>
            <p className="text-text-secondary text-xs">
              {canContinue ? "Ready to continue" : `Choose ${MIN_TOPICS} to proceed`}
            </p>
          </div>
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className="ml-auto bg-accent text-accent-contrast font-medium h-12 px-8 rounded-full disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
