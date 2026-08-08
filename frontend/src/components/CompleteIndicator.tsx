export function CompleteIndicator({ fading }: { fading: boolean }) {
  return (
    <span
      role="status"
      aria-label="Answer complete"
      title="Answer complete"
      className={`w-1.5 h-1.5 rounded-full bg-success shrink-0 transition-opacity duration-300 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    />
  );
}
