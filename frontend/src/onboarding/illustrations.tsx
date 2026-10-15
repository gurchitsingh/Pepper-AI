import type { ComponentType, ReactNode } from "react";
import { Clapperboard, AudioLines, FileText, PenLine } from "lucide-react";
import { Mark } from "../components/Mark";

function Blob({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-[300px] h-[250px] flex items-center justify-center">
      <div
        className="absolute w-[220px] h-[210px] bg-tint"
        style={{ borderRadius: "58% 42% 55% 45% / 48% 56% 44% 52%" }}
      />
      {children}
    </div>
  );
}

function IconBubble({ Icon }: { Icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }> }) {
  return (
    <div className="relative w-28 h-28 rounded-full bg-surface border border-line shadow-[var(--shadow-card)] flex items-center justify-center">
      <Icon size={44} strokeWidth={1.5} className="text-accent-ink" />
    </div>
  );
}

function FloatingPill({
  Icon,
  label,
  className,
}: {
  Icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  className: string;
}) {
  return (
    <div
      className={`absolute h-9 px-3 rounded-full bg-surface border border-line shadow-[var(--shadow-card)] flex items-center gap-1.5 text-[13px] font-medium ${className}`}
    >
      <Icon size={15} className="text-accent-ink" />
      {label}
    </div>
  );
}

export function MeetPepperIllustration() {
  return (
    <Blob>
      <Mark size={120} className="shadow-[0_18px_40px_-16px_rgba(0,0,0,0.45)]" />
    </Blob>
  );
}

export function SaveAnythingIllustration() {
  return (
    <Blob>
      <div className="relative">
        <IconBubble Icon={Clapperboard} />
      </div>
      <FloatingPill Icon={Clapperboard} label="Reel" className="left-[6px] top-[22px]" />
      <FloatingPill Icon={AudioLines} label="Lecture" className="right-0 top-[58px]" />
      <FloatingPill Icon={FileText} label="PDF" className="left-5 bottom-9" />
      <FloatingPill Icon={PenLine} label="Note" className="right-[22px] bottom-3" />
    </Blob>
  );
}

export function TranscribedIllustration() {
  const bars = [
    { h: 9, strong: false },
    { h: 20, strong: true },
    { h: 14, strong: false },
    { h: 25, strong: false },
    { h: 11, strong: true },
    { h: 16, strong: false },
    { h: 7, strong: false },
    { h: 22, strong: true },
    { h: 13, strong: false },
    { h: 18, strong: false },
    { h: 10, strong: true },
  ];
  return (
    <Blob>
      <div className="relative w-64 box-border bg-surface border border-line rounded-2xl shadow-[var(--shadow-card)] p-4 flex flex-col gap-3 text-left">
        <div className="flex items-center gap-1 h-[26px]">
          {bars.map((b, i) => (
            <span
              key={i}
              className="w-[5px] rounded-sm bg-accent"
              style={{ height: b.h, opacity: b.strong ? 1 : 0.5 }}
            />
          ))}
        </div>
        <div className="h-px bg-line" />
        <div className="flex gap-2.5">
          <span className="flex-none text-[11px] leading-[19px] font-medium text-accent-ink">23:40</span>
          <span className="text-[13px] leading-[19px]">
            Think of a bank. It only lends if it can still pay everyone back.
          </span>
        </div>
      </div>
    </Blob>
  );
}

export function ChatWithKnowledgeIllustration() {
  return (
    <Blob>
      <div className="relative w-[264px] flex flex-col gap-2 text-left">
        <div className="self-end max-w-[210px] bg-accent text-accent-contrast rounded-[16px_16px_4px_16px] px-[13px] py-[9px] text-[13px] leading-[18px]">
          What did round 2 cover?
        </div>
        <div className="max-w-[230px] bg-surface border border-line rounded-[16px_16px_16px_4px] shadow-[var(--shadow-card)] px-[13px] py-[11px] flex flex-col gap-2">
          <span className="text-[13px] leading-[19px]">
            Two DSA questions: one sliding window, one on binary trees.
          </span>
          <span className="flex items-center gap-1.5 text-[11px] leading-[14px] text-text-secondary">
            <Clapperboard size={12} className="text-accent-ink" />
            Reel · How I cracked the Amazon…
          </span>
        </div>
      </div>
    </Blob>
  );
}
