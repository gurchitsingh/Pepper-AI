import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Link2, Mic, FileImage, LayoutGrid, Folder as FolderIcon, RefreshCw, Rows3 } from "lucide-react";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { Folder, SavedItem } from "../api/types";

const FILTERS = [
  { id: "all", label: "All", Icon: LayoutGrid, match: () => true },
  { id: "note", label: "Notes", Icon: FileText, match: (t: string) => t === "note" },
  { id: "link", label: "Links", Icon: Link2, match: (t: string) => t === "article" || t === "youtube" },
  { id: "voice", label: "Voice", Icon: Mic, match: (t: string) => t === "voice_note" },
  { id: "document", label: "Documents", Icon: FileImage, match: (t: string) => t === "document" },
] as const;

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

const UNSORTED_ID = "__unsorted__";

function itemTitle(item: SavedItem): string {
  if (item.title) return item.title;
  if (item.source_type === "note" && item.transcript) {
    return item.transcript.slice(0, 60) + (item.transcript.length > 60 ? "..." : "");
  }
  return item.source_url ?? `${item.source_type} item`;
}

function ItemCard({ item }: { item: SavedItem }) {
  const Icon = TYPE_ICON[item.source_type] ?? FileText;
  return (
    <motion.div
      key={item.id}
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

export function Library() {
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [grouped, setGrouped] = useState(true);
  const [reorganizing, setReorganizing] = useState(false);

  function refresh() {
    return Promise.all([api.listSavedItems(), api.listFolders()]).then(([savedItems, folderList]) => {
      setItems(savedItems);
      setFolders(folderList);
    });
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load library"));
  }, []);

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
  const filtered = items?.filter((item) => activeFilter.match(item.source_type)) ?? [];

  const sections: { id: string; name: string; items: SavedItem[] }[] = [];
  if (grouped && folders) {
    for (const folder of folders) {
      const folderItems = filtered.filter((item) => item.folder_id === folder.id);
      if (folderItems.length > 0) sections.push({ id: folder.id, name: folder.name, items: folderItems });
    }
    const unsorted = filtered.filter((item) => !item.folder_id || !folders.some((f) => f.id === item.folder_id));
    if (unsorted.length > 0) sections.push({ id: UNSORTED_ID, name: "Unsorted", items: unsorted });
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="font-heading text-text-primary text-2xl font-bold">Library</h2>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setGrouped((g) => !g)}
            title={grouped ? "Show flat list" : "Group by folder"}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs border bg-surface text-text-secondary border-text-secondary/20"
          >
            {grouped ? <FolderIcon size={14} /> : <Rows3 size={14} />}
            {grouped ? "Folders" : "Flat"}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleReorganize}
            disabled={reorganizing}
            title="Re-organize into folders now"
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs border bg-surface text-text-secondary border-text-secondary/20 disabled:opacity-50"
          >
            <RefreshCw size={14} className={reorganizing ? "animate-spin" : ""} />
            {reorganizing ? "Organizing..." : "Re-organize"}
          </motion.button>
        </div>
      </div>

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

      {error && <p className="text-error text-sm">{error}</p>}
      {items === null && !error && <p className="text-text-secondary text-sm">Loading...</p>}
      {items?.length !== undefined && filtered.length === 0 && (
        <p className="text-text-secondary text-sm">Nothing filed under this yet.</p>
      )}

      {grouped && folders ? (
        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <div key={section.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <FolderIcon size={16} className="text-accent" />
                <h3 className="font-heading text-text-primary font-semibold">{section.name}</h3>
                <span className="text-text-secondary text-xs">{section.items.length}</span>
              </div>
              <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {section.items.map((item) => (
                    <ItemCard key={item.id} item={item} />
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
              <ItemCard key={item.id} item={item} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
