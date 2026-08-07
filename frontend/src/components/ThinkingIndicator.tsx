import { motion } from "framer-motion";

const DOTS = [0, 1, 2];

export function ThinkingIndicator() {
  return (
    <div
      role="status"
      aria-label="Pepper is thinking"
      className="glass-card rounded-2xl px-4 py-3 w-fit flex items-center gap-1.5"
    >
      {DOTS.map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-accent"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.16,
          }}
        />
      ))}
    </div>
  );
}
