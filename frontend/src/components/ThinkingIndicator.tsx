import { motion } from "framer-motion";
import { Mark } from "./Mark";

const DOTS = [0, 1, 2];

export function ThinkingIndicator({ savedCount }: { savedCount: number }) {
  return (
    <div role="status" aria-label="Pepper is thinking" className="flex items-center gap-3">
      <motion.div
        animate={{ boxShadow: ["0 0 0 0px var(--tint)", "0 0 0 5px var(--tint)", "0 0 0 0px var(--tint)"] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="rounded-[7px]"
      >
        <Mark size={32} />
      </motion.div>
      <div className="glass-card rounded-2xl px-4 py-3 w-fit flex items-center gap-2.5">
        <span className="text-text-secondary text-sm">
          Searching your {savedCount} save{savedCount === 1 ? "" : "s"}&hellip;
        </span>
        <div className="flex items-center gap-1.5">
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
      </div>
    </div>
  );
}
