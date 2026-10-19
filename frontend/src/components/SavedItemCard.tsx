import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FileText, Link2, Mic, FileImage, MoreVertical } from "lucide-react";
import type { SavedItem } from "../api/types";
import { relativeTime } from "../lib/format";

const TYPE_ICON: Record<string, typeof FileText> = {
  note: FileText,
  article: Link2,
  youtube: Link2,
  voice_note: Mic,
  document: FileImage,
  instagram: Link2,
  tiktok: Link2,
  facebook: Link2,
};

const TYPE_LABEL: Record<string, string> = {
  note: "Note",
  article: "Link",
  youtube: "Video",
  voice_note: "Voice",
  document: "Document",
  instagram: "Link",
  tiktok: "Link",
  facebook: "Link",
};

const STATUS_BADGE: Record<SavedItem["status"], string> = {
  ready: "bg-success/15 text-success",
  pending: "bg-text-secondary/15 text-text-secondary",
  processing: "bg-accent/15 text-accent",
  failed: "bg-error/15 text-error",
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
  const typeLabel = TYPE_LABEL[item.source_type] ?? item.source_type;

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
        className="group bg-surface border border-text-secondary/15 rounded-xl overflow-hidden hover:border-accent/50 transition-colors flex flex-col p-4 gap-3 h-full"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-full bg-bg flex items-center justify-center shrink-0">
              <Icon size={16} className="text-accent" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary truncate">
              {typeLabel}
            </span>
          </div>
          <span
            className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full shrink-0 ${STATUS_BADGE[item.status]}`}
          >
            {item.status}
          </span>
        </div>

        <h3 className="font-heading text-text-primary text-lg font-semibold leading-snug line-clamp-2">
          {itemTitle(item)}
        </h3>

        {item.failure_reason ? (
          <p className="text-error text-xs line-clamp-2">{item.failure_reason}</p>
        ) : (
          item.transcript && (
            <p className="text-text-secondary text-sm line-clamp-2">{item.transcript}</p>
          )
        )}

        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-text-secondary/70 text-xs">
            {typeLabel} &bull; {relativeTime(item.created_at)}
          </span>
          <MoreVertical size={16} className="text-text-secondary/50 group-hover:text-accent transition-colors" />
        </div>
      </Link>
    </motion.div>
  );
}
