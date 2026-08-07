import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ThemePicker } from "../components/ThemePicker";

const INTERESTS = [
  "Technology",
  "Business",
  "Personal Development",
  "Health & Wellness",
  "Science",
  "Creativity",
  "News & Current Events",
  "Entertainment",
];

export function Preferences() {
  const [interests, setInterests] = useState<string[]>([]);
  const navigate = useNavigate();

  function toggleInterest(interest: string) {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }

  function handleContinue() {
    // No backend field for interests yet — captured locally only.
    console.log("Selected interests:", interests);
    navigate("/source");
  }

  return (
    <div className="min-h-screen flex flex-col px-6 py-12 max-w-lg mx-auto gap-10">
      <div>
        <h1 className="font-heading text-text-primary text-2xl font-bold mb-1">Make it yours</h1>
        <p className="text-text-secondary text-sm">Choose a theme, then tell us what you care about.</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-text-primary text-lg font-semibold">Theme</h2>
        <ThemePicker />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-text-primary text-lg font-semibold">Interests</h2>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((interest) => {
            const selected = interests.includes(interest);
            return (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                  selected
                    ? "bg-accent text-accent-contrast border-accent"
                    : "bg-surface text-text-secondary border-text-secondary/20"
                }`}
              >
                {interest}
              </button>
            );
          })}
        </div>
      </section>

      <button
        onClick={handleContinue}
        className="bg-accent text-accent-contrast font-medium h-12 rounded-full mt-auto"
      >
        Continue
      </button>
    </div>
  );
}
