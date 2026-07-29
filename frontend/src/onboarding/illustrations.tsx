function Blob() {
  return (
    <path
      d="M80 18c22 0 41 12 50 31 8 17 4 38-9 52-14 15-35 21-56 17-20-4-37-18-42-38-5-19 2-40 18-52C54 18 68 18 80 18Z"
      fill="var(--accent)"
      fillOpacity="0.14"
    />
  );
}

export function MeetPepperIllustration() {
  return (
    <svg viewBox="0 0 160 160" className="h-28 w-28" aria-hidden="true">
      <Blob />
      <rect x="42" y="52" width="76" height="54" rx="20" fill="var(--accent)" />
      <path d="M62 106l-4 16 20-16z" fill="var(--accent)" />
      <circle cx="66" cy="78" r="6" fill="var(--accent-contrast)" />
      <circle cx="94" cy="78" r="6" fill="var(--accent-contrast)" />
      <path
        d="M68 90c4 5 20 5 24 0"
        stroke="var(--accent-contrast)"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M104 40l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"
        fill="var(--accent)"
      />
    </svg>
  );
}

export function SaveAnythingIllustration() {
  return (
    <svg viewBox="0 0 160 160" className="h-28 w-28" aria-hidden="true">
      <Blob />
      <path
        d="M46 62h68a8 8 0 0 1 8 8v34a8 8 0 0 1-8 8H46a8 8 0 0 1-8-8V70a8 8 0 0 1 8-8Z"
        fill="var(--surface)"
        stroke="var(--accent)"
        strokeWidth="3"
      />
      <path d="M38 68l42-24 42 24" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="65" cy="88" r="12" fill="var(--accent)" fillOpacity="0.18" />
      <path d="M62 82l10 6-10 6z" fill="var(--accent)" />
      <rect x="90" y="82" width="20" height="4" rx="2" fill="var(--text-secondary)" />
      <rect x="90" y="91" width="14" height="4" rx="2" fill="var(--text-secondary)" />
    </svg>
  );
}

export function TranscribedIllustration() {
  const bars = [10, 22, 15, 28, 12];
  return (
    <svg viewBox="0 0 160 160" className="h-28 w-28" aria-hidden="true">
      <Blob />
      {bars.map((h, i) => (
        <rect
          key={i}
          x={38 + i * 10}
          y={80 - h}
          width="6"
          height={h * 2}
          rx="3"
          fill="var(--accent)"
          fillOpacity={i === 2 ? 1 : 0.5}
        />
      ))}
      <path
        d="M100 80h14"
        stroke="var(--text-secondary)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect x="118" y="66" width="30" height="5" rx="2.5" fill="var(--text-secondary)" />
      <rect x="118" y="77" width="24" height="5" rx="2.5" fill="var(--text-secondary)" />
      <rect x="118" y="88" width="28" height="5" rx="2.5" fill="var(--text-secondary)" />
    </svg>
  );
}

export function ChatWithKnowledgeIllustration() {
  return (
    <svg viewBox="0 0 160 160" className="h-28 w-28" aria-hidden="true">
      <Blob />
      <rect x="32" y="54" width="46" height="58" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.5" />
      <rect x="40" y="64" width="30" height="4" rx="2" fill="var(--text-secondary)" />
      <rect x="40" y="73" width="30" height="4" rx="2" fill="var(--text-secondary)" />
      <rect x="40" y="82" width="18" height="4" rx="2" fill="var(--text-secondary)" />
      <path
        d="M84 66h40a10 10 0 0 1 10 10v18a10 10 0 0 1-10 10H108l-10 10v-10h-4a10 10 0 0 1-10-10V76a10 10 0 0 1-10-10Z"
        fill="var(--accent)"
      />
      <circle cx="98" cy="86" r="3.5" fill="var(--accent-contrast)" />
      <circle cx="112" cy="86" r="3.5" fill="var(--accent-contrast)" />
      <circle cx="126" cy="86" r="3.5" fill="var(--accent-contrast)" />
    </svg>
  );
}
