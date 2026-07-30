import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, FileText, Link2, Mic, FileImage, Flame } from "lucide-react";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { SavedItem } from "../api/types";
import { computeStreak } from "./streak";

const TYPE_ICON: Record<string, typeof FileText> = {
  note: FileText,
  article: Link2,
  youtube: Link2,
  voice_note: Mic,
  document: FileImage,
  instagram: Link2,
  tiktok: Link2,
};

function itemTitle(item: SavedItem): string {
  if (item.title) return item.title;
  if (item.source_type === "note" && item.transcript) {
    return item.transcript.slice(0, 60) + (item.transcript.length > 60 ? "..." : "");
  }
  return item.source_url ?? `${item.source_type} item`;
}

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export function Home() {
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listSavedItems()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load saves"));
  }, []);

  const total = items?.length ?? 0;
  const ready = items?.filter((i) => i.status === "ready").length ?? 0;
  const processing = items?.filter((i) => i.status === "pending" || i.status === "processing").length ?? 0;
  const recent = items?.slice(0, 6) ?? [];
  const streak = computeStreak(items ?? []);

  return (
    <div className="max-w-[600px] mx-auto px-6 flex flex-col gap-8">
      {streak > 0 && (
        <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-2 w-fit">
          <Flame size={20} className="text-accent" />
          <span className="font-heading text-text-primary font-bold">{streak}</span>
          <span className="text-text-secondary text-sm">day streak</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Saved", value: total },
          { label: "Ready", value: ready },
          { label: "Processing", value: processing },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-2xl p-4 flex flex-col items-center gap-1">
            <span className="font-heading text-text-primary text-2xl font-bold">{stat.value}</span>
            <span className="text-text-secondary text-xs uppercase tracking-wide">{stat.label}</span>
          </div>
        ))}
      </div>

      <Link to="/save">
        <motion.div
          whileTap={{ scale: 0.97 }}
          className="btn-accent font-medium h-14 rounded-full flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Save something
        </motion.div>
      </Link>

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-text-primary text-xl font-bold">Recent saves</h2>

        {error && <p className="text-error text-sm">{error}</p>}
        {items === null && !error && <p className="text-text-secondary text-sm">Loading...</p>}
        {items?.length === 0 && (
          <p className="text-text-secondary text-sm">Nothing saved yet — tap "Save something" to get started.</p>
        )}

        <motion.div variants={listVariants} initial="hidden" animate="show" className="flex flex-col gap-3">
          {recent.map((item) => {
            const Icon = TYPE_ICON[item.source_type] ?? FileText;
            return (
              <motion.div
                key={item.id}
                variants={cardVariants}
                className="glass-card rounded-2xl p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-bg flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-accent" />
                </div>
                <div className="min-w-0 flex-grow">
                  <span className="text-[10px] text-text-secondary font-medium uppercase tracking-widest">
                    {item.source_type}
                  </span>
                  <h3 className="font-body text-text-primary font-medium truncate">{itemTitle(item)}</h3>
                </div>
                <span className="text-xs text-text-secondary shrink-0">{item.status}</span>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
