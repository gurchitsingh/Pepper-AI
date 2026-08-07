import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame, Bookmark, Loader2 } from "lucide-react";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { SavedItem } from "../api/types";
import { computeStreak } from "./streak";
import { SavedItemCard } from "../components/SavedItemCard";
import { SearchBar } from "../components/SearchBar";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function StatRing({
  icon,
  value,
  label,
  progress,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  progress: number;
}) {
  const offset = RING_CIRCUMFERENCE * (1 - progress);
  return (
    <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
      <div className="relative w-12 h-12 shrink-0">
        <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
          <circle cx="24" cy="24" r={RING_RADIUS} fill="none" stroke="var(--text-secondary)" strokeOpacity="0.15" strokeWidth="4" />
          <circle
            cx="24"
            cy="24"
            r={RING_RADIUS}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-accent">{icon}</span>
      </div>
      <div className="flex flex-col">
        <span className="font-heading text-text-primary text-2xl font-bold leading-none">{value}</span>
        <span className="text-text-secondary text-xs uppercase tracking-wide mt-1">{label}</span>
      </div>
    </div>
  );
}

export function Home() {
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const total = items?.length ?? 0;
  const processing = items?.filter((i) => i.status === "pending" || i.status === "processing").length ?? 0;
  const recent = items?.slice(0, 6) ?? [];
  const streak = computeStreak(items ?? []);

  return (
    <div className="max-w-[600px] mx-auto px-6 flex flex-col gap-8">
      <SearchBar id="page-search" value={query} onChange={setQuery} placeholder="Search your saves..." />

      {!isSearchMode && streak > 0 && (
        <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-2 w-fit">
          <Flame size={20} className="text-accent" />
          <span className="font-heading text-text-primary font-bold">{streak}</span>
          <span className="text-text-secondary text-sm">day streak</span>
        </div>
      )}

      {!isSearchMode && (
        <div className="grid grid-cols-2 gap-3">
          <StatRing icon={<Bookmark size={16} />} value={total} label="Items saved" progress={total > 0 ? 1 : 0} />
          <StatRing
            icon={<Loader2 size={16} />}
            value={processing}
            label="Processing"
            progress={total > 0 ? processing / total : 0}
          />
        </div>
      )}

      {isSearchMode ? (
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-text-primary text-xl font-bold">Search results</h2>

          {searchError && <p className="text-error text-sm">{searchError}</p>}
          {searching && searchResults === null && <p className="text-text-secondary text-sm">Searching...</p>}
          {!searching && !searchError && (searchResults?.length ?? 0) === 0 && (
            <p className="text-text-secondary text-sm">No results for &ldquo;{debouncedQuery}&rdquo;.</p>
          )}

          <div className="flex flex-col gap-3">
            {(searchResults ?? []).map((item) => (
              <SavedItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-text-primary text-xl font-bold">Recent Saves</h2>
            <Link to="/library" className="text-accent text-sm hover:underline">
              View all
            </Link>
          </div>

          {error && <p className="text-error text-sm">{error}</p>}
          {items === null && !error && <p className="text-text-secondary text-sm">Loading...</p>}
          {items?.length === 0 && (
            <p className="text-text-secondary text-sm">Nothing here yet — save something and it'll show up below.</p>
          )}

          <motion.div variants={listVariants} initial="hidden" animate="show" className="flex flex-col gap-3">
            {recent.map((item) => (
              <SavedItemCard key={item.id} item={item} />
            ))}
          </motion.div>
        </div>
      )}
    </div>
  );
}
