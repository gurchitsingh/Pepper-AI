import { motion } from "framer-motion";
import { X } from "lucide-react";
import { DURATION_ENTER, DURATION_EXIT, EASE_IN, EASE_OUT } from "../lib/motion";

interface SheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function Sheet({ title, onClose, children }: SheetProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: DURATION_ENTER, ease: EASE_OUT } }}
      exit={{ opacity: 0, transition: { duration: DURATION_EXIT, ease: EASE_IN } }}
      className="fixed inset-0 z-[60] bg-black/55 flex items-end justify-center p-3"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-card rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-text-primary text-lg font-bold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-text-secondary hover:text-accent-ink">
            <X size={20} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
