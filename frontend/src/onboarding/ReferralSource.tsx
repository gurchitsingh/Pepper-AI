import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setOnboarded } from "./onboardingStatus";

const SOURCES = ["Google search", "Social media", "Friend or referral", "Ads", "YouTube", "Other"];

export function ReferralSource() {
  const [selected, setSelected] = useState<string | null>(null);
  const navigate = useNavigate();

  function handleFinish() {
    // No backend field for referral source yet — captured locally only.
    console.log("Heard about Pepper via:", selected);
    setOnboarded();
    navigate("/");
  }

  return (
    <div className="min-h-screen flex flex-col px-6 py-12 max-w-sm mx-auto gap-8">
      <div>
        <h1 className="font-heading text-text-primary text-2xl font-bold mb-1">One last thing</h1>
        <p className="text-text-secondary text-sm">Where did you first hear about Pepper?</p>
      </div>

      <div className="flex flex-col gap-2">
        {SOURCES.map((source) => (
          <button
            key={source}
            onClick={() => setSelected(source)}
            className={`text-left px-4 py-3 rounded-lg border transition-colors ${
              selected === source
                ? "bg-accent/10 border-accent text-text-primary"
                : "bg-surface border-text-secondary/20 text-text-secondary"
            }`}
          >
            {source}
          </button>
        ))}
      </div>

      <button
        onClick={handleFinish}
        disabled={!selected}
        className="bg-accent text-accent-contrast font-medium h-12 rounded-full mt-auto disabled:opacity-50"
      >
        Finish
      </button>
    </div>
  );
}
