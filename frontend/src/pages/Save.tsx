import { useState, type FormEvent } from "react";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { SavedItem } from "../api/types";

const COMING_SOON = [
  { icon: "photo_camera", label: "Capture", desc: "Instant screenshots and document scanning." },
  { icon: "mic", label: "Voice Note", desc: "Capture audio and auto-transcribe to text." },
  { icon: "link", label: "Paste Link", desc: "Save URLs for later deep-learning analysis." },
];

export function Save() {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedItem | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(null);
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const item = await api.createNote(content);
      setSaved(item);
      setContent("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save note");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[600px] mx-auto px-6 flex flex-col gap-4">
      <h2 className="font-display text-on-surface text-2xl font-bold mb-2">Quick Thought</h2>

      <form onSubmit={handleSubmit} className="glass-card rounded-3xl p-6 flex flex-col gap-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Capture a fleeting insight..."
          rows={6}
          className="bg-surface-container-high rounded-lg px-4 py-3 text-on-surface outline-none focus:ring-2 focus:ring-primary resize-none"
        />
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="bg-primary text-on-primary font-medium h-12 rounded-full disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save note"}
        </button>
        {error && <p className="text-error text-sm">{error}</p>}
        {saved && (
          <p className="text-tertiary text-sm">
            Saved — item <span className="font-mono">{saved.id.slice(0, 8)}</span>, status:{" "}
            <span className="font-medium">{saved.status}</span>
          </p>
        )}
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        {COMING_SOON.map((tile) => (
          <div
            key={tile.label}
            className="glass-card rounded-2xl flex flex-col items-center justify-center p-6 min-h-[160px] opacity-50"
          >
            <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-primary text-2xl">{tile.icon}</span>
            </div>
            <h3 className="font-body text-on-surface font-medium">{tile.label}</h3>
            <p className="font-body text-on-surface-variant text-xs text-center mt-1">{tile.desc}</p>
            <span className="text-[10px] uppercase tracking-wider text-on-surface-variant mt-2">Coming soon</span>
          </div>
        ))}
      </div>
    </div>
  );
}
