import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { SavedItem } from "../api/types";
import { SavedItemCard } from "../components/SavedItemCard";

const DAY_MS = 24 * 60 * 60 * 1000;

const CATEGORY_GROUPS: { id: string; label: string; color: string; match: (t: string) => boolean }[] = [
  { id: "notes", label: "Notes", color: "var(--accent)", match: (t) => t === "note" },
  { id: "links", label: "Links", color: "color-mix(in srgb, var(--accent) 55%, transparent)", match: (t) => t === "article" || t === "youtube" || t === "instagram" || t === "tiktok" },
  { id: "voice", label: "Voice", color: "var(--text-secondary)", match: (t) => t === "voice_note" },
  { id: "documents", label: "Documents", color: "var(--color-success)", match: (t) => t === "document" },
];

const RING_R = 40;
const RING_C = 2 * Math.PI * RING_R;

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function Insights() {
  const [items, setItems] = useState<SavedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listSavedItems()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load insights"));
  }, []);

  const now = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => startOfDay(now), [now]);

  const thisWeekItems = useMemo(() => {
    if (!items) return [];
    const cutoff = todayStart.getTime() - 6 * DAY_MS;
    return items.filter((i) => new Date(i.created_at).getTime() >= cutoff);
  }, [items, todayStart]);

  const lastWeekCount = useMemo(() => {
    if (!items) return 0;
    const end = todayStart.getTime() - 6 * DAY_MS;
    const start = end - 7 * DAY_MS;
    return items.filter((i) => {
      const t = new Date(i.created_at).getTime();
      return t >= start && t < end;
    }).length;
  }, [items, todayStart]);

  const weekOverWeekPct =
    lastWeekCount > 0 ? Math.round(((thisWeekItems.length - lastWeekCount) / lastWeekCount) * 100) : null;

  const categories = useMemo(() => {
    const total = thisWeekItems.length;
    return CATEGORY_GROUPS.map((g) => {
      const count = thisWeekItems.filter((i) => g.match(i.source_type)).length;
      return { ...g, count, pct: total > 0 ? count / total : 0 };
    });
  }, [thisWeekItems]);

  const totalThisWeek = thisWeekItems.length;

  const dailyTrend = useMemo(() => {
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = todayStart.getTime() - i * DAY_MS;
      const dayEnd = dayStart + DAY_MS;
      const count = (items ?? []).filter((it) => {
        const t = new Date(it.created_at).getTime();
        return t >= dayStart && t < dayEnd;
      }).length;
      days.push({ label: new Date(dayStart).toLocaleDateString("en-US", { weekday: "short" }), count });
    }
    return days;
  }, [items, todayStart]);

  const maxDaily = Math.max(1, ...dailyTrend.map((d) => d.count));
  const trendPoints = dailyTrend
    .map((d, i) => {
      const x = (i / (dailyTrend.length - 1)) * 100;
      const y = 100 - (d.count / maxDaily) * 90;
      return `${x},${y}`;
    })
    .join(" ");

  const recent = (items ?? []).slice(0, 3);

  let offsetAccum = 0;

  return (
    <div className="max-w-[700px] mx-auto px-6 flex flex-col gap-8">
      <section>
        <h2 className="font-heading text-text-primary text-2xl font-semibold mb-1">Weekly Review</h2>
        <p className="text-text-secondary text-base">
          {items === null ? "Loading..." : `You saved ${totalThisWeek} item${totalThisWeek === 1 ? "" : "s"} this week.`}
        </p>
        {error && <p className="text-error text-sm mt-2">{error}</p>}
      </section>

      {items !== null && (
        <>
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
                <span className="font-heading text-text-primary text-2xl font-semibold">{totalThisWeek}</span>
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

          <section className="p-5 bg-surface border border-text-secondary/15 rounded-xl">
            <div className="flex justify-between items-end mb-4">
              <div>
                <h3 className="text-text-secondary text-[11px] font-semibold uppercase tracking-widest mb-1">
                  Consumption Trend
                </h3>
                <p className="font-heading text-text-primary text-xl font-semibold">
                  {weekOverWeekPct === null
                    ? `${totalThisWeek} saved this week`
                    : `${weekOverWeekPct >= 0 ? "+" : ""}${weekOverWeekPct}% vs last week`}
                </p>
              </div>
            </div>
            <div className="h-28 w-full">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                <line x1="0" x2="100" y1="100" y2="100" stroke="var(--text-secondary)" strokeOpacity="0.15" strokeWidth="1" vectorEffect="non-scaling-stroke" />
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
            <div className="flex justify-between mt-3 text-text-secondary text-[11px]">
              {dailyTrend.map((d, i) => (
                <span key={i}>{d.label}</span>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="flex flex-col gap-3 pb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-text-primary text-lg font-semibold">Recent Activity</h3>
          <Link to="/library" className="text-accent text-sm hover:underline">
            View All
          </Link>
        </div>
        {recent.length === 0 && items !== null && (
          <p className="text-text-secondary text-sm">Nothing saved yet.</p>
        )}
        <div className="flex flex-col gap-3">
          {recent.map((item) => (
            <SavedItemCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
