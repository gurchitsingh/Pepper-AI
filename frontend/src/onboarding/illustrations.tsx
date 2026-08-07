import type { ComponentType } from "react";
import { Brain, Layers, MessagesSquare } from "lucide-react";

function IconBubble({ Icon }: { Icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }) {
  return (
    <div className="w-28 h-28 rounded-full bg-surface border border-text-secondary/10 flex items-center justify-center">
      <Icon size={44} strokeWidth={1.5} className="text-accent" />
    </div>
  );
}

export function MeetPepperIllustration() {
  return <IconBubble Icon={Brain} />;
}

export function SaveAnythingIllustration() {
  return <IconBubble Icon={Layers} />;
}

export function TranscribedIllustration() {
  const bars = [10, 22, 15, 28, 12];
  return (
    <div className="w-28 h-28 rounded-full bg-surface border border-text-secondary/10 flex items-center justify-center">
      <svg viewBox="0 0 80 56" className="h-11 w-11" aria-hidden="true">
        {bars.map((h, i) => (
          <rect
            key={i}
            x={i * 16}
            y={28 - h}
            width="8"
            height={h * 2}
            rx="4"
            fill="var(--accent)"
            fillOpacity={i === 2 ? 1 : 0.5}
          />
        ))}
      </svg>
    </div>
  );
}

export function ChatWithKnowledgeIllustration() {
  return <IconBubble Icon={MessagesSquare} />;
}
