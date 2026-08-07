import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Link2, Mic, FileImage, Folder as FolderIcon } from "lucide-react";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { Insights as InsightsData } from "../api/types";

const TYPE_ICON: Record<string, typeof FileText> = {
  note: FileText,
  article: Link2,
  youtube: Link2,
  voice_note: Mic,
  document: FileImage,
  instagram: Link2,
  tiktok: Link2,
};

const TYPE_LABEL: Record<string, string> = {
  note: "Notes",
  article: "Articles",
  youtube: "YouTube",
  voice_note: "Voice notes",
  document: "Documents",
  instagram: "Instagram",
  tiktok: "TikTok",
};

function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.getDate().toString();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Bar({ fraction }: { fraction: number }) {
  return (
    <div className="h-2 rounded-full bg-bg overflow-hidden">
      <div
        className="h-full rounded-full bg-accent"
        style={{ width: `${Math.max(fraction * 100, fraction > 0 ? 4 : 0)}%` }}
      />
    </div>
  );
}

export function Insights() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getInsights()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load insights"));
  }, []);

  if (error) {
    return (
      <div className="max-w-[600px] mx-auto px-6">
        <p className="text-error text-sm">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-[600px] mx-auto px-6">
        <p className="text-text-secondary text-sm">Loading...</p>
      </div>
    );
  }

  if (data.total_items === 0) {
    return (
      <div className="max-w-[600px] mx-auto px-6 flex flex-col items-center text-center gap-3 mt-16">
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

  const realFolders = data.by_folder.filter((f) => f.folder_id !== null);
  const unsorted = data.by_folder.find((f) => f.folder_id === null);
  const maxTrend = Math.max(...data.trend.map((t) => t.count), 1);

  return (
    <div className="max-w-[600px] mx-auto px-6 flex flex-col gap-8">
      <h2 className="font-heading text-text-primary text-2xl font-bold">Insights</h2>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Saved", value: data.total_items },
          { label: "Ready", value: data.ready_items },
          { label: "Processing", value: data.processing_items },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-2xl p-4 flex flex-col items-center gap-1">
            <span className="font-heading text-text-primary text-2xl font-bold">{stat.value}</span>
            <span className="text-text-secondary text-xs uppercase tracking-wide">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="font-heading text-text-primary font-semibold">By type</h3>
        <div className="glass-card rounded-2xl p-4 flex flex-col gap-4">
          {data.by_type.map(({ source_type, count }) => {
            const Icon = TYPE_ICON[source_type] ?? FileText;
            return (
              <div key={source_type} className="flex items-center gap-3">
                <Icon size={16} className="text-accent shrink-0" />
                <div className="flex-grow min-w-0 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-primary font-medium">{TYPE_LABEL[source_type] ?? source_type}</span>
                    <span className="text-text-secondary">{count}</span>
                  </div>
                  <Bar fraction={count / data.total_items} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="font-heading text-text-primary font-semibold">By folder</h3>
        {realFolders.length === 0 ? (
          <div className="glass-card rounded-2xl p-4">
            <p className="text-text-secondary text-sm">
              Save a few more items and Pepper will start grouping them into folders automatically.
            </p>
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-4 flex flex-col gap-4">
            {[...realFolders, ...(unsorted && unsorted.count > 0 ? [unsorted] : [])].map((folder) => (
              <div key={folder.folder_id ?? "unsorted"} className="flex items-center gap-3">
                <FolderIcon size={16} className="text-accent shrink-0" />
                <div className="flex-grow min-w-0 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-primary font-medium truncate">{folder.folder_name}</span>
                    <span className="text-text-secondary">{folder.count}</span>
                  </div>
                  <Bar fraction={folder.count / data.total_items} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="font-heading text-text-primary font-semibold">Last 14 days</h3>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-end justify-between gap-1 h-24">
            {data.trend.map((point) => (
              <div key={point.date} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                <div
                  className="w-full rounded-t bg-accent"
                  style={{ height: `${Math.max((point.count / maxTrend) * 100, point.count > 0 ? 6 : 2)}%` }}
                  title={`${point.date}: ${point.count} saved`}
                />
                <span className="text-text-secondary text-[9px]">{formatDay(point.date)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data.first_saved_at && (
        <p className="text-text-secondary text-xs text-center">Saving with Pepper since {formatDate(data.first_saved_at)}</p>
      )}
    </div>
  );
}
