import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Link2, Mic, FileImage, LayoutGrid } from "lucide-react";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { SavedItem } from "../api/types";
import { SavedItemCard } from "../components/SavedItemCard";
import { SearchBar } from "../components/SearchBar";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

const FILTERS = [
  { id: "all", label: "All", Icon: LayoutGrid, match: () => true },
  { id: "note", label: "Notes", Icon: FileText, match: (t: string) => t === "note" },
  { id: "link", label: "Links", Icon: Link2, match: (t: string) => t === "article" || t === "youtube" },
  { id: "voice", label: "Voice", Icon: Mic, match: (t: string) => t === "voice_note" },
  { id: "document", label: "Documents", Icon: FileImage, match: (t: string) => t === "document" },
] as const;

export function Library() {
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const [searchResults, setSearchResults] = useState<SavedItem[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    api
      .listSavedItems()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load library"));
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
  const activeFilter = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
  const baseList = isSearchMode ? searchResults ?? [] : items ?? [];
  const filtered = baseList.filter((item) => activeFilter.match(item.source_type));

  return (
    <div className="max-w-[1200px] mx-auto px-6 flex flex-col gap-4">
      <h2 className="font-heading text-text-primary text-2xl font-bold mb-2">Library</h2>

      <SearchBar value={query} onChange={setQuery} placeholder="Search titles, transcripts, and sources..." />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(({ id, label, Icon }) => {
          const isActive = filter === id;
          return (
            <motion.button
              key={id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilter(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm border shrink-0 transition-colors ${
                isActive
                  ? "bg-accent text-accent-contrast border-accent"
                  : "bg-surface text-text-secondary border-text-secondary/20"
              }`}
            >
              <Icon size={14} />
              {label}
            </motion.button>
          );
        })}
      </div>

      {isSearchMode ? (
        <>
          {searchError && <p className="text-error text-sm">{searchError}</p>}
          {searching && searchResults === null && <p className="text-text-secondary text-sm">Searching...</p>}
          {!searching && !searchError && filtered.length === 0 && (
            <p className="text-text-secondary text-sm">No results for &ldquo;{debouncedQuery}&rdquo;.</p>
          )}
        </>
      ) : (
        <>
          {error && <p className="text-error text-sm">{error}</p>}
          {items === null && !error && <p className="text-text-secondary text-sm">Loading...</p>}
          {items?.length !== undefined && filtered.length === 0 && (
            <p className="text-text-secondary text-sm">Nothing filed under this yet.</p>
          )}
        </>
      )}

      <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((item) => (
            <SavedItemCard key={item.id} item={item} />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
