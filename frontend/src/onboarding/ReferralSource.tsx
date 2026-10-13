import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Search, PlayCircle, Zap, MessageSquare, Globe } from "lucide-react";
import { setOnboarded } from "./onboardingStatus";
import { updateMe } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";

const SOURCES = [
  { label: "LinkedIn", desc: "Professional network", Icon: Briefcase },
  { label: "Google", desc: "Search & Discovery", Icon: Search },
  { label: "YouTube", desc: "Visual reviews", Icon: PlayCircle },
  { label: "Claude", desc: "AI Recommendations", Icon: Zap },
  { label: "ChatGPT", desc: "Conversation discovery", Icon: MessageSquare },
  { label: "Internet", desc: "Blogs & Articles", Icon: Globe },
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
      <div>
        <h1 className="font-heading text-text-primary text-2xl font-bold mb-1">How did you find us?</h1>
        <p className="text-text-secondary text-sm">Help us understand how the word is spreading.</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {SOURCES.map(({ label, desc, Icon }) => {
          const isSelected = selected === label;
          return (
            <button
              key={label}
              onClick={() => setSelected(label)}
              className={`flex items-center justify-between px-4 py-3.5 rounded-xl border transition-colors ${
                isSelected ? "bg-accent/10 border-accent" : "bg-surface border-text-secondary/15"
              }`}
            >
              <div className="text-left">
                <p className="text-text-primary font-semibold text-sm">{label}</p>
                <p className="text-text-secondary text-xs">{desc}</p>
              </div>
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
