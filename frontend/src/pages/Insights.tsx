import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { Insights as InsightsData, SavedItem } from "../api/types";
import { SavedItemCard } from "../components/SavedItemCard";

const CATEGORY_GROUPS: { id: string; label: string; color: string; match: (t: string) => boolean }[] = [
  { id: "notes", label: "Notes", color: "var(--accent)", match: (t) => t === "note" },
  {
    id: "links",
    label: "Links",
    color: "color-mix(in srgb, var(--accent) 55%, transparent)",
    match: (t) => t === "article" || t === "youtube" || t === "instagram" || t === "tiktok",
  },
  { id: "voice", label: "Voice", color: "var(--text-secondary)", match: (t) => t === "voice_note" },
  { id: "documents", label: "Documents", color: "var(--color-success)", match: (t) => t === "document" },
];

const RING_R = 40;
const RING_C = 2 * Math.PI * RING_R;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function Insights() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getInsights()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load insights"));
    api.listSavedItems().then(setItems).catch(() => {});
  }, []);

  const categories = useMemo(() => {
    if (!data) return [];
    const countFor = (group: (typeof CATEGORY_GROUPS)[number]) =>
      data.by_type.filter((t) => group.match(t.source_type)).reduce((sum, t) => sum + t.count, 0);
    return CATEGORY_GROUPS.map((g) => {
      const count = countFor(g);
      return { ...g, count, pct: data.total_items > 0 ? count / data.total_items : 0 };
    });
  }, [data]);

  const maxTrend = Math.max(1, ...(data?.trend.map((t) => t.count) ?? [0]));
  const trendPoints = data
    ? data.trend
        .map((point, i) => {
          const x = (i / (data.trend.length - 1)) * 100;
          const y = 100 - (point.count / maxTrend) * 90;
          return `${x},${y}`;
        })
        .join(" ")
    : "";

  const realFolders = data?.by_folder.filter((f) => f.folder_id !== null) ?? [];
  const unsorted = data?.by_folder.find((f) => f.folder_id === null);
  const folderRows = [...realFolders, ...(unsorted && unsorted.count > 0 ? [unsorted] : [])];

  const recent = (items ?? []).slice(0, 3);

  let offsetAccum = 0;

  if (error) {
    return (
      <div className="max-w-[700px] mx-auto px-6">
        <p className="text-error text-sm">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-[700px] mx-auto px-6">
        <p className="text-text-secondary text-sm">Loading...</p>
      </div>
    );
  }

  if (data.total_items === 0) {
    return (
      <div className="max-w-[700px] mx-auto px-6 flex flex-col items-center text-center gap-3 mt-16">
        <h2 className="font-heading text-text-primary text-2xl font-bold">Insights</h2>
        <p className="text-text-secondary text-sm">
          Nothing saved yet — save something and your insights will show up here.
        </p>
        <Link to="/save" className="text-accent text-sm font-medium">
          Save something
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[700px] mx-auto px-6 flex flex-col gap-8">
      <section>
        <h2 className="font-heading text-text-primary text-2xl font-semibold mb-1">Insights</h2>
        <p className="text-text-secondary text-base">
          {data.total_items} item{data.total_items === 1 ? "" : "s"} saved
          {data.first_saved_at && <> since {formatDate(data.first_saved_at)}</>}.
        </p>
      </section>

      <section className="grid grid-cols-3 gap-3">
        {[
          { label: "Ready", value: data.ready_items },
          { label: "Processing", value: data.processing_items },
          { label: "Failed", value: data.failed_items },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-2xl p-4 flex flex-col items-center gap-1">
            <span className="font-heading text-text-primary text-2xl font-bold">{stat.value}</span>
            <span className="text-text-secondary text-xs uppercase tracking-wide">{stat.label}</span>
          </div>
        ))}
      </section>

      <section className="flex flex-col md:flex-row items-center gap-8">
        <div className="w-52 h-52 shrink-0 relative">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r={RING_R} fill="none" stroke="var(--text-secondary)" strokeOpacity="0.12" strokeWidth="8" />
            {categories
              .filter((c) => c.count > 0)
              .map((c) => {
                const dash = c.pct * RING_C;
                const el = (
                  <circle
                    key={c.id}
                    cx="50"
                    cy="50"
                    r={RING_R}
                    fill="none"
                    stroke={c.color}
                    strokeWidth="8"
                    strokeDasharray={`${dash} ${RING_C}`}
                    strokeDashoffset={-offsetAccum}
                  />
                );
                offsetAccum += dash;
                return el;
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-heading text-text-primary text-2xl font-semibold">{data.total_items}</span>
            <span className="text-text-secondary text-[11px] uppercase tracking-widest">Items</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-4 py-3 bg-surface border border-text-secondary/15 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color }} />
                <span className="text-text-primary text-sm">{c.label}</span>
              </div>
              <span className="text-text-secondary text-sm">{c.count} items</span>
            </div>
          ))}
        </div>
      </section>

      {folderRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="font-heading text-text-primary text-lg font-semibold">By folder</h3>
          <div className="glass-card rounded-2xl p-4 flex flex-col gap-3">
            {folderRows.map((folder) => (
              <div
                key={folder.folder_id ?? "unsorted"}
                className="flex items-center justify-between px-4 py-3 bg-surface border border-text-secondary/15 rounded-lg"
              >
                <span className="text-text-primary text-sm truncate">{folder.folder_name}</span>
                <span className="text-text-secondary text-sm">{folder.count} items</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="p-5 bg-surface border border-text-secondary/15 rounded-xl">
        <h3 className="text-text-secondary text-[11px] font-semibold uppercase tracking-widest mb-4">
          Last {data.trend.length} days
        </h3>
        <div className="h-28 w-full">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
            <line
              x1="0"
              x2="100"
              y1="100"
              y2="100"
              stroke="var(--text-secondary)"
              strokeOpacity="0.15"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              points={trendPoints}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
        <div className="flex justify-between mt-3 text-text-secondary text-[9px]">
          {data.trend.map((point) => (
            <span key={point.date}>{new Date(`${point.date}T00:00:00`).getDate()}</span>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 pb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-text-primary text-lg font-semibold">Recent Activity</h3>
          <Link to="/library" className="text-accent text-sm hover:underline">
            View All
          </Link>
        </div>
        {recent.length === 0 && items !== null && <p className="text-text-secondary text-sm">Nothing saved yet.</p>}
        <div className="flex flex-col gap-3">
          {recent.map((item) => (
            <SavedItemCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
