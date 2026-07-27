import { useEffect, useState } from "react";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { SavedItem } from "../api/types";

const STATUS_COLOR: Record<SavedItem["status"], string> = {
  ready: "text-tertiary",
  pending: "text-on-surface-variant",
  processing: "text-primary",
  failed: "text-error",
};

function itemTitle(item: SavedItem): string {
  if (item.title) return item.title;
  if (item.source_type === "note" && item.transcript) {
    return item.transcript.slice(0, 60) + (item.transcript.length > 60 ? "..." : "");
  }
  return item.source_url ?? "(untitled)";
}

export function Library() {
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listSavedItems()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load library"));
  }, []);

  return (
    <div className="max-w-[1200px] mx-auto px-6 flex flex-col gap-4">
      <h2 className="font-display text-on-surface text-2xl font-bold mb-2">Library</h2>

      {error && <p className="text-error text-sm">{error}</p>}
      {items === null && !error && <p className="text-on-surface-variant text-sm">Loading...</p>}
      {items?.length === 0 && <p className="text-on-surface-variant text-sm">No saved items yet.</p>}

      <div className="grid grid-cols-1 gap-4">
        {items?.map((item) => (
          <div key={item.id} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="text-[10px] text-on-surface-variant font-medium uppercase tracking-widest">
                {item.source_type}
              </span>
              <h3 className="font-body text-on-surface font-medium truncate">{itemTitle(item)}</h3>
              {item.failure_reason && (
                <p className="text-error text-xs mt-1 truncate">{item.failure_reason}</p>
              )}
            </div>
            <span className={`text-sm font-medium shrink-0 ${STATUS_COLOR[item.status]}`}>{item.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
