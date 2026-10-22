/** The Pepper brand mark: a bold Fraunces "P" centered in a rounded accent-orange
 * tile. Reused at a handful of fixed sizes across the app (see presets below) —
 * always pass a preset rather than an arbitrary size, so the mark stays consistent. */

interface MarkProps {
  size: 20 | 26 | 28 | 32 | 64 | 120;
  className?: string;
  ringTint?: boolean;
}

const PRESETS: Record<MarkProps["size"], { radius: number; fontSize: number; marginTop: number }> = {
  20: { radius: 5, fontSize: 14, marginTop: -1 },
  26: { radius: 6, fontSize: 18, marginTop: -1 },
  28: { radius: 6, fontSize: 20, marginTop: -1 },
  32: { radius: 7, fontSize: 22, marginTop: -2 },
  64: { radius: 14, fontSize: 45, marginTop: -3 },
  120: { radius: 27, fontSize: 84, marginTop: -6 },
};

export function Mark({ size, className = "", ringTint = false }: MarkProps) {
  const { radius, fontSize, marginTop } = PRESETS[size];
  return (
    <div
      className={`flex-none flex items-center justify-center bg-accent ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        boxShadow: ringTint ? "0 0 0 5px var(--tint)" : undefined,
      }}
    >
      <span
        className="font-heading font-bold text-accent-contrast leading-none"
        style={{ fontSize, marginTop }}
      >
        P
      </span>
    </div>
  );
}
