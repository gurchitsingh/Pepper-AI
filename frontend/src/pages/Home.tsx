import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Flame,
  Check,
  MessageCircle,
  PenLine,
  Link2,
  CirclePlay,
  AudioLines,
  FileText,
  Clapperboard,
  Loader2,
} from "lucide-react";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { SavedItem } from "../api/types";
import { computeStreak } from "./streak";
import { SavedItemCard } from "../components/SavedItemCard";
import { ExpandableSearch } from "../components/ExpandableSearch";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const RECENT_FEED_LIMIT = 8;

const TYPE_META: Record<string, { label: string; Icon: typeof FileText }> = {
  note: { label: "Note", Icon: PenLine },
  article: { label: "Article", Icon: Link2 },
  youtube: { label: "YouTube", Icon: CirclePlay },
  voice_note: { label: "Voice note", Icon: AudioLines },
  document: { label: "Document", Icon: FileText },
  instagram: { label: "Reel", Icon: Clapperboard },
  tiktok: { label: "Reel", Icon: Clapperboard },
};

const ASK_TEMPLATES: Record<string, (title: string) => string> = {
  note: (t) => `What did I write about "${t}"?`,
  article: (t) => `What's the key takeaway from "${t}"?`,
  youtube: (t) => `What was "${t}" about?`,
  voice_note: (t) => `What did I say in "${t}"?`,
  document: (t) => `What's in "${t}"?`,
  instagram: (t) => `What did I save from "${t}"?`,
  tiktok: (t) => `What did I save from "${t}"?`,
};

function truncate(text: string, max = 48): string {
  const trimmed = text.trim();
  return trimmed.length > max ? trimmed.slice(0, max).trimEnd() + "…" : trimmed;
}

function itemTitle(item: SavedItem): string {
  if (item.title?.trim()) return item.title.trim();
  if (item.transcript?.trim()) return item.transcript.trim();
  return `${TYPE_META[item.source_type]?.label ?? item.source_type} item`;
}

function askQuestionFor(item: SavedItem): string | null {
  if (item.status !== "ready") return null;
  const title = item.title?.trim() || item.transcript?.trim();
  if (!title) return null;
  const template = ASK_TEMPLATES[item.source_type] ?? ((t: string) => `Tell me about "${t}".`);
  return template(truncate(title));
}

function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  if (seconds < 90) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return `${Math.round(seconds / 60)} min`;
}

function formatTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .toLowerCase();
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const startOfDay = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  };
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function groupByDay(items: SavedItem[]): { label: string; items: SavedItem[] }[] {
  const groups: { label: string; items: SavedItem[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

function computeWeek(items: SavedItem[]): { d: string; on: boolean }[] {
  const days = new Set(
    items.map((i) => {
      const d = new Date(i.created_at);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const week: { d: string; on: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today.getTime() - i * 86_400_000);
    week.push({ d: WEEKDAY_LETTERS[day.getDay()], on: days.has(day.getTime()) });
  }
  return week;
}

function StreakCard({ items }: { items: SavedItem[] }) {
  const streak = computeStreak(items);
  const week = computeWeek(items);

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3.5 bg-surface border border-line"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {streak > 0 ? (
        <div className="flex items-center gap-2">
          <Flame size={20} className="text-accent-ink" />
          <span className="font-heading text-text-primary text-lg font-semibold">
            {streak} day streak
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Flame size={20} className="text-text-secondary" />
          <span className="text-text-primary text-[15px]">Save something today to start a streak</span>
        </div>
      )}
      <div className="grid grid-cols-7 gap-1">
        {week.map((w, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className="text-text-secondary text-[11px] font-medium">{w.d}</span>
            {w.on ? (
              <div className="w-[34px] h-[34px] rounded-full bg-accent text-accent-contrast flex items-center justify-center">
                <Check size={16} strokeWidth={2.25} />
              </div>
            ) : (
              <div className="w-[34px] h-[34px] rounded-full border border-dashed border-line bg-bg" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HomeFeedItem({
  item,
  showTime,
  onAsk,
}: {
  item: SavedItem;
  showTime: boolean;
  onAsk: (item: SavedItem) => void;
}) {
  const meta = TYPE_META[item.source_type] ?? { label: item.source_type, Icon: FileText };
  const Icon = meta.Icon;
  const duration = formatDuration(item.duration_seconds);
  const metaParts = [meta.label, duration, showTime ? formatTime(item.created_at) : null].filter(Boolean);
  const question = askQuestionFor(item);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl bg-surface border border-line flex flex-col gap-3 p-4"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <Link to={`/library/${item.id}`} className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-tint text-accent-ink flex items-center justify-center shrink-0">
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-text-secondary text-[11px] font-medium uppercase tracking-widest truncate">
            {metaParts.join(" · ")}
          </span>
          <span className="text-text-primary text-[15px] font-medium leading-snug line-clamp-2">
            {itemTitle(item)}
          </span>
          {item.status === "processing" && (
            <span className="flex items-center gap-1.5 text-text-secondary text-xs mt-1">
              <Loader2 size={12} className="animate-spin" />
              Transcribing…
            </span>
          )}
          {item.status === "pending" && <span className="text-text-secondary text-xs mt-1">Queued…</span>}
          {item.status === "failed" && item.failure_reason && (
            <span className="text-error text-xs mt-1 line-clamp-2">{item.failure_reason}</span>
          )}
        </div>
      </Link>

      {question && (
        <button
          type="button"
          onClick={() => onAsk(item)}
          className="flex items-center gap-2 pt-3 border-t border-line text-left"
        >
          <MessageCircle size={15} className="text-accent-ink shrink-0" />
          <span className="flex-1 text-accent-ink text-[13px] font-medium leading-snug">{question}</span>
        </button>
      )}
    </motion.div>
  );
}

export function Home() {
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const [searchResults, setSearchResults] = useState<SavedItem[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    api
      .listSavedItems()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load saves"));
  }, []);

  useEffect(() => {
    if (!debouncedQuery) {
      setSearchResults(null);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    api
      .searchSavedItems(debouncedQuery)
      .then((results) => {
        if (!cancelled) setSearchResults(results);
      })
      .catch((err) => {
        if (!cancelled) setSearchError(err instanceof ApiError ? err.message : "Search failed");
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const isSearchMode = debouncedQuery.length > 0;
  const recent = items?.slice(0, RECENT_FEED_LIMIT) ?? [];
  const groups = groupByDay(recent);

  function askAboutItem(item: SavedItem) {
    const question = askQuestionFor(item);
    if (!question) return;
    navigate("/chat", { state: { prefillQuestion: question } });
  }

  return (
    <div className="max-w-[600px] mx-auto px-6 flex flex-col gap-5">
      <div className="flex justify-end">
        <ExpandableSearch value={query} onChange={setQuery} placeholder="Search your saves..." />
      </div>

      {!isSearchMode && <StreakCard items={items ?? []} />}

      {isSearchMode ? (
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-text-primary text-xl font-bold">Search results</h2>

          {searchError && <p className="text-error text-sm">{searchError}</p>}
          {searching && searchResults === null && <p className="text-text-secondary text-sm">Searching...</p>}
          {!searching && !searchError && (searchResults?.length ?? 0) === 0 && (
            <p className="text-text-secondary text-sm">No results for &ldquo;{debouncedQuery}&rdquo;.</p>
          )}

          <motion.div layout className="flex flex-col gap-3">
            <AnimatePresence mode="popLayout">
              {(searchResults ?? []).map((item) => (
                <SavedItemCard key={item.id} item={item} />
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-text-primary text-xl font-bold">Recent Saves</h2>
            <Link to="/library" className="text-accent-ink text-sm font-medium hover:underline">
              View all
            </Link>
          </div>

          {error && <p className="text-error text-sm">{error}</p>}
          {items === null && !error && <p className="text-text-secondary text-sm">Loading...</p>}
          {items?.length === 0 && (
            <p className="text-text-secondary text-sm">Nothing here yet — save something and it'll show up below.</p>
          )}

          <motion.div layout variants={listVariants} initial="hidden" animate="show" className="flex flex-col gap-5">
            <AnimatePresence mode="popLayout">
              {groups.map((group) => (
                <div key={group.label} className="flex flex-col gap-2.5">
                  <span className="text-text-secondary text-[11px] font-medium uppercase tracking-widest">
                    {group.label}
                  </span>
                  <div className="flex flex-col gap-3">
                    {group.items.map((item) => (
                      <HomeFeedItem
                        key={item.id}
                        item={item}
                        showTime={group.label === "Today"}
                        onAsk={askAboutItem}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </div>
  );
}
