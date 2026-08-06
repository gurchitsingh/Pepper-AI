import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Flame } from "lucide-react";
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
  const ready = items?.filter((i) => i.status === "ready").length ?? 0;
  const processing = items?.filter((i) => i.status === "pending" || i.status === "processing").length ?? 0;
  const recent = items?.slice(0, 6) ?? [];
  const streak = computeStreak(items ?? []);

  return (
    <div className="max-w-[600px] mx-auto px-6 flex flex-col gap-8">
      <SearchBar value={query} onChange={setQuery} placeholder="Search your saves..." />

      {!isSearchMode && streak > 0 && (
        <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-2 w-fit">
          <Flame size={20} className="text-accent" />
          <span className="font-heading text-text-primary font-bold">{streak}</span>
          <span className="text-text-secondary text-sm">day streak</span>
        </div>
      )}

      {!isSearchMode && (
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
      )}

      {!isSearchMode && (
        <Link to="/save">
          <motion.div
            whileTap={{ scale: 0.97 }}
            className="bg-accent text-accent-contrast font-medium h-14 rounded-full flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            Save something
          </motion.div>
        </Link>
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
          <h2 className="font-heading text-text-primary text-xl font-bold">Recent saves</h2>

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
