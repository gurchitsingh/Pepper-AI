import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Link2, Mic, FileImage, Infinity as InfinityIcon, Folder as FolderIcon, RefreshCw, Rows3 } from "lucide-react";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { Folder, SavedItem } from "../api/types";
import { SavedItemCard } from "../components/SavedItemCard";
import { ExpandableSearch } from "../components/ExpandableSearch";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

const FILTERS = [
  { id: "all", label: "All", Icon: InfinityIcon, match: () => true },
  { id: "note", label: "Notes", Icon: FileText, match: (t: string) => t === "note" },
  { id: "link", label: "Links", Icon: Link2, match: (t: string) => t === "article" || t === "youtube" || t === "instagram" || t === "tiktok" || t === "facebook" },
  { id: "voice", label: "Voice", Icon: Mic, match: (t: string) => t === "voice_note" },
  { id: "document", label: "Documents", Icon: FileImage, match: (t: string) => t === "document" },
] as const;

const UNSORTED_ID = "__unsorted__";

export function Library() {
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [grouped, setGrouped] = useState(true);
  const [reorganizing, setReorganizing] = useState(false);

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const [searchResults, setSearchResults] = useState<SavedItem[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  function refresh() {
    return Promise.all([api.listSavedItems(), api.listFolders()]).then(([savedItems, folderList]) => {
      setItems(savedItems);
      setFolders(folderList);
    });
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load library"));
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

  async function handleReorganize() {
    setReorganizing(true);
    setError(null);
    try {
      await api.recomputeFolders();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to re-organize folders");
    } finally {
      setReorganizing(false);
    }
  }

  const activeFilter = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
  const baseList = isSearchMode ? searchResults ?? [] : items ?? [];
  const filtered = baseList.filter((item) => activeFilter.match(item.source_type));

  const sections: { id: string; name: string; items: SavedItem[] }[] = [];
  if (!isSearchMode && grouped && folders) {
    for (const folder of folders) {
      const folderItems = filtered.filter((item) => item.folder_id === folder.id);
      if (folderItems.length > 0) sections.push({ id: folder.id, name: folder.name, items: folderItems });
    }
    const unsorted = filtered.filter((item) => !item.folder_id || !folders.some((f) => f.id === item.folder_id));
    if (unsorted.length > 0) sections.push({ id: UNSORTED_ID, name: "Unsorted", items: unsorted });
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 flex flex-col gap-4 relative">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="font-heading text-text-primary text-2xl font-bold">Library</h2>
        <div className="flex items-center gap-2">
          <ExpandableSearch value={query} onChange={setQuery} placeholder="Search titles, transcripts, and sources..." />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setGrouped((g) => !g)}
            title={grouped ? "Show flat list" : "Group by folder"}
            className={`flex items-center justify-center w-10 h-10 rounded-full bg-surface shrink-0 transition-colors ${
              grouped ? "text-accent-ink" : "text-text-secondary hover:text-accent-ink"
            }`}
          >
            {grouped ? <FolderIcon size={16} /> : <Rows3 size={16} />}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleReorganize}
            disabled={reorganizing}
            title="Re-organize into folders now"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-surface shrink-0 text-text-secondary hover:text-accent-ink disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={16} className={reorganizing ? "animate-spin" : ""} />
          </motion.button>
        </div>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-1 border-b border-line">
        {FILTERS.map(({ id, label, Icon }) => {
          const isActive = filter === id;
          return (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`flex flex-col items-center gap-1 pb-2.5 border-b-2 shrink-0 transition-colors ${
                isActive ? "border-accent text-accent-ink" : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              <Icon size={18} strokeWidth={1.5} />
              <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
            </button>
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

      {!isSearchMode && grouped && folders ? (
        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <div key={section.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <FolderIcon size={16} className={section.id === UNSORTED_ID ? "text-text-secondary" : "text-accent-ink"} />
                <h3 className="font-heading text-text-primary text-lg font-semibold">{section.name}</h3>
                <span className="text-text-secondary text-xs">{section.items.length}</span>
              </div>
              <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {section.items.map((item) => (
                    <SavedItemCard key={item.id} item={item} />
                  ))}
                </AnimatePresence>
              </motion.div>
            </div>
          ))}
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((item) => (
              <SavedItemCard key={item.id} item={item} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
