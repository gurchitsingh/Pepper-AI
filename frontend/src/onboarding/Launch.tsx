import { useEffect } from "react";
import { motion } from "framer-motion";

const LAUNCH_DURATION_MS = 1300;

export function Launch({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, LAUNCH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
      className="fixed inset-0 bg-accent text-accent-contrast flex flex-col"
    >
      <div className="flex-1 flex items-center justify-center pb-10">
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="font-heading font-bold leading-none"
          style={{ fontSize: 196, marginTop: -14 }}
        >
          P
        </motion.span>
      </div>
      <div className="flex flex-col items-center gap-2 pb-16 px-8">
        <span className="font-heading text-2xl font-bold tracking-tight">Pepper AI</span>
        <span className="text-sm">Intellectual calm for focused minds.</span>
      </div>
    </motion.div>
  );
}
