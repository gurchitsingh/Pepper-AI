import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FileText, Link2, Mic, FileImage } from "lucide-react";
import type { SavedItem } from "../api/types";

const TYPE_ICON: Record<string, typeof FileText> = {
  note: FileText,
  article: Link2,
  youtube: Link2,
  voice_note: Mic,
  document: FileImage,
  instagram: Link2,
  tiktok: Link2,
};

const STATUS_COLOR: Record<SavedItem["status"], string> = {
  ready: "text-success",
  pending: "text-text-secondary",
  processing: "text-accent",
  failed: "text-error",
};

export function itemTitle(item: SavedItem): string {
  if (item.title) return item.title;
  if (item.source_type === "note" && item.transcript) {
    return item.transcript.slice(0, 60) + (item.transcript.length > 60 ? "..." : "");
  }
  return item.source_url ?? `${item.source_type} item`;
}

export function SavedItemCard({ item }: { item: SavedItem }) {
  const Icon = TYPE_ICON[item.source_type] ?? FileText;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.25 }}
    >
      <Link
        to={`/library/${item.id}`}
        className="glass-card rounded-2xl p-4 flex items-center gap-3 w-full text-left"
      >
        <div className="w-10 h-10 rounded-full bg-bg flex items-center justify-center shrink-0">
          <Icon size={18} className="text-accent" />
        </div>
        <div className="min-w-0 flex-grow">
          <span className="text-[10px] text-text-secondary font-medium uppercase tracking-widest">
            {item.source_type}
          </span>
          <h3 className="font-body text-text-primary font-medium truncate">{itemTitle(item)}</h3>
          {item.failure_reason && <p className="text-error text-xs mt-1 truncate">{item.failure_reason}</p>}
        </div>
        <span className={`text-sm font-medium shrink-0 ${STATUS_COLOR[item.status]}`}>{item.status}</span>
      </Link>
    </motion.div>
  );
}
