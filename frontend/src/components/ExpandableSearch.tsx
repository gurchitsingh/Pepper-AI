import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X } from "lucide-react";

interface ExpandableSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

export function ExpandableSearch({
  value,
  onChange,
  onSubmit,
  placeholder = "Search...",
  ariaLabel = "Search",
  className = "",
}: ExpandableSearchProps) {
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  function toggle() {
    setExpanded((e) => !e);
  }

  function handleClear() {
    onChange("");
    setExpanded(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit?.();
    setExpanded(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setExpanded(false);
  }

  return (
    <motion.div
      layout
      initial={false}
      animate={{ width: expanded ? "100%" : 44 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={`h-11 max-w-full bg-surface border border-text-secondary/20 rounded-full flex items-center overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={expanded ? "Collapse search" : ariaLabel}
        aria-expanded={expanded}
        className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-text-secondary hover:text-accent transition-colors"
      >
        <Search size={18} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.1 } }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="flex items-center flex-1 min-w-0 pr-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              aria-label={ariaLabel}
              className="flex-1 min-w-0 bg-transparent outline-none text-text-primary placeholder:text-text-secondary"
            />
            {value && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear search"
                className="shrink-0 ml-2 text-text-secondary hover:text-accent transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
