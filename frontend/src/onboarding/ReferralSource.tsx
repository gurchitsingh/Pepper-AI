import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Users, Ticket, CirclePlay, Briefcase, Search, Sparkles, Ellipsis } from "lucide-react";
import { setOnboarded } from "./onboardingStatus";
import { updateMe } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";

const SOURCES = [
  { label: "Instagram", Icon: Camera },
  { label: "A friend or classmate", Icon: Users },
  { label: "College club or fest", Icon: Ticket },
  { label: "YouTube", Icon: CirclePlay },
  { label: "LinkedIn", Icon: Briefcase },
  { label: "Google", Icon: Search },
  { label: "ChatGPT or Claude", Icon: Sparkles },
  { label: "Other", Icon: Ellipsis },
] as const;

export function ReferralSource() {
  const [selected, setSelected] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const { refreshUser } = useAuth();
  const navigate = useNavigate();

  async function handleFinish() {
    if (!selected || finishing) return;
    setFinishing(true);
    try {
      await updateMe({ referral_source: selected, onboarding_completed: true });
      await refreshUser();
    } catch {
      // non-fatal: localStorage fallback still marks onboarding complete
    } finally {
      setFinishing(false);
    }
    setOnboarded();
    navigate("/");
  }

  return (
    <div className="min-h-screen flex flex-col px-6 py-12 max-w-sm mx-auto gap-8">
      <h1 className="font-heading text-text-primary text-2xl font-bold">How did you find us?</h1>

      <div className="flex flex-col gap-2.5">
        {SOURCES.map(({ label, Icon }) => {
          const isSelected = selected === label;
          return (
            <button
              key={label}
              onClick={() => setSelected(label)}
              className={`flex items-center justify-between px-4 py-3.5 rounded-xl border transition-colors ${
                isSelected ? "bg-accent/10 border-accent" : "bg-surface border-text-secondary/15"
              }`}
            >
              <p className="text-text-primary font-semibold text-sm text-left">{label}</p>
              <Icon size={18} className={isSelected ? "text-accent" : "text-text-secondary"} />
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-text-secondary text-[11px] font-semibold uppercase tracking-widest">
            Survey progress
          </span>
          <div className="h-1 rounded-full bg-text-secondary/15 overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: "90%" }} />
          </div>
        </div>
        <button
          onClick={handleFinish}
          disabled={!selected || finishing}
          className="btn-accent font-medium h-12 rounded-full disabled:opacity-50"
        >
          {finishing ? "Finishing..." : "Finish"}
        </button>
      </div>
    </div>
  );
}
