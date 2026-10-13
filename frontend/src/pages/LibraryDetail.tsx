import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, FileText, Link2, Mic, FileImage, Trash2, Pencil, Folder as FolderIcon, Play, Pause } from "lucide-react";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { SavedItem } from "../api/types";
import { DURATION_ENTER, DURATION_EXIT, EASE_IN, EASE_OUT } from "../lib/motion";

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
  note: "Note",
  article: "Link",
  youtube: "YouTube",
  voice_note: "Voice",
  document: "Document",
  instagram: "Reel",
  tiktok: "Clip",
};

function formatRecordedAt(iso: string): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) return "0:00";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const value = Number(e.target.value);
    audio.currentTime = value;
    setCurrentTime(value);
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="bg-surface border border-line rounded-2xl p-3 flex items-center gap-3.5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <audio ref={audioRef} src={src} className="hidden" />
      <button
        onClick={togglePlay}
        aria-label={playing ? "Pause" : "Play"}
        className="w-11 h-11 shrink-0 rounded-full bg-accent text-accent-contrast flex items-center justify-center"
      >
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      </button>
      <div className="flex-1 flex flex-col gap-2">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          aria-label="Seek"
          className="w-full h-1 rounded-full appearance-none cursor-pointer accent-accent"
          style={{ background: `linear-gradient(to right, var(--accent) ${progress}%, var(--surface-2, var(--line)) ${progress}%)` }}
        />
        <div className="flex justify-between text-text-secondary text-xs">
          <span>{formatClock(currentTime)}</span>
          <span>{formatClock(duration)}</span>
        </div>
      </div>
    </div>
  );
}

export function LibraryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<SavedItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getSavedItem(id)
      .then(setItem)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load item"));
  }, [id]);

  useEffect(() => {
    if (!id || !item || item.source_type !== "voice_note") return;
    let objectUrl: string | null = null;
    api
      .getSavedItemAudio(id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setAudioUrl(objectUrl);
      })
      .catch((err) => setAudioError(err instanceof ApiError ? err.message : "Failed to load audio"));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, item]);

  function handleConfirmDelete() {
    if (!id) return;
    setDeleting(true);
    setDeleteError(null);
    api
      .deleteSavedItem(id)
      .then(() => navigate("/library"))
      .catch((err) => {
        setDeleteError(err instanceof ApiError ? err.message : "Failed to delete item");
        setDeleting(false);
        setConfirmingDelete(false);
      });
  }

  function startEditing() {
    if (!item) return;
    setEditTitle(item.title ?? "");
    setEditContent(item.transcript ?? "");
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setSaveError(null);
  }

  function handleSaveEdit() {
    if (!id || !item) return;
    const isNote = item.source_type === "note";
    if (isNote && !editContent.trim()) {
      setSaveError("Content can't be empty");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const payload: { title?: string | null; content?: string } = { title: editTitle.trim() || null };
    if (isNote) payload.content = editContent;
    api
      .updateSavedItem(id, payload)
      .then((updated) => {
        setItem(updated);
        setEditing(false);
        setSaving(false);
      })
      .catch((err) => {
        setSaveError(err instanceof ApiError ? err.message : "Failed to save changes");
        setSaving(false);
      });
  }

  const Icon = item ? TYPE_ICON[item.source_type] ?? FileText : FileText;
  const typeLabel = item ? TYPE_LABEL[item.source_type] ?? item.source_type : "";

  return (
    <div className="max-w-[700px] mx-auto px-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          to="/library"
          aria-label="Back to Library"
          className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-text-primary hover:text-accent-ink transition-colors"
        >
          <ArrowLeft size={19} />
        </Link>

        {item && !editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={startEditing}
              aria-label="Edit item"
              className="h-10 rounded-full bg-surface flex items-center gap-1.5 px-3.5 text-text-primary text-sm font-medium hover:text-accent-ink transition-colors"
            >
              <Pencil size={15} />
              Edit
            </button>
            <button
              onClick={() => setConfirmingDelete(true)}
              aria-label="Delete item"
              className="h-10 rounded-full border border-error/20 flex items-center gap-1.5 px-3.5 text-error text-sm font-medium hover:opacity-80"
            >
              <Trash2 size={15} />
              Delete
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-error text-sm">{error}</p>}
      {deleteError && <p className="text-error text-sm">{deleteError}</p>}
      {saveError && <p className="text-error text-sm">{saveError}</p>}
      {!item && !error && <p className="text-text-secondary text-sm">Loading...</p>}

      {item && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 shrink-0 rounded-[10px] bg-tint text-accent-ink flex items-center justify-center">
              <Icon size={16} />
            </span>
            <span className="flex-1 text-text-secondary text-[11px] font-semibold uppercase tracking-widest">
              {typeLabel}
              {item.source_type === "voice_note" && item.duration_seconds
                ? ` · ${Math.round(item.duration_seconds / 60)} min`
                : ""}
            </span>
            {item.folder_name && (
              <span className="flex items-center gap-1 text-xs text-accent-ink bg-surface rounded-full px-2.5 py-1 shrink-0">
                <FolderIcon size={12} />
                {item.folder_name}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            {editing ? (
              <input
                type="text"
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Title (optional)"
                className="bg-surface border border-line rounded-lg px-4 py-3 text-text-primary font-heading text-xl font-semibold outline-none focus:ring-2 focus:ring-accent"
              />
            ) : (
              item.title && (
                <h2 className="font-heading text-text-primary text-2xl font-semibold" style={{ textWrap: "balance" }}>
                  {item.title}
                </h2>
              )
            )}
            <span className="text-text-secondary text-sm">Saved {formatRecordedAt(item.created_at)}</span>
          </div>

          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-ink text-sm break-all hover:underline"
            >
              {item.source_url}
            </a>
          )}

          {item.failure_reason && <p className="text-error text-sm">{item.failure_reason}</p>}

          {item.source_type === "voice_note" &&
            (audioUrl ? (
              <AudioPlayer src={audioUrl} />
            ) : audioError ? (
              <p className="text-error text-sm">{audioError}</p>
            ) : (
              <p className="text-text-secondary text-sm">Loading audio...</p>
            ))}

          {item.status !== "failed" && (
            <>
              {item.status === "ready" && item.transcript && (
                <span className="text-text-secondary text-[11px] font-semibold uppercase tracking-widest pt-1">
                  Transcript
                </span>
              )}
              {item.status !== "ready" ? (
                <p className="text-text-secondary text-sm">Still processing ({item.status})...</p>
              ) : editing && item.source_type === "note" ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                  className="bg-surface border border-line rounded-lg px-4 py-3 text-text-primary font-body outline-none focus:ring-2 focus:ring-accent resize-none"
                />
              ) : item.transcript ? (
                <p className="font-body text-text-primary whitespace-pre-wrap leading-relaxed">{item.transcript}</p>
              ) : (
                <p className="text-text-secondary text-sm italic">Pepper couldn't find any text in this one.</p>
              )}
            </>
          )}

          {editing && (
            <div className="flex gap-3 pt-1">
              <button
                onClick={cancelEditing}
                disabled={saving}
                className="flex-grow h-11 rounded-full bg-surface text-text-secondary border border-line disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-grow h-11 rounded-full bg-accent text-accent-contrast font-medium disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {confirmingDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DURATION_ENTER, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: DURATION_EXIT, ease: EASE_IN } }}
            className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center px-4"
            onClick={() => !deleting && setConfirmingDelete(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: DURATION_ENTER, ease: EASE_OUT } }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: DURATION_EXIT, ease: EASE_IN } }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card rounded-2xl p-6 w-full max-w-xs flex flex-col gap-4 text-center"
            >
              <p className="text-text-primary font-medium">Delete this item?</p>
              <p className="text-text-secondary text-sm">This can't be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="flex-grow h-11 rounded-full bg-surface text-text-secondary border border-line disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="flex-grow h-11 rounded-full bg-error text-white font-medium disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
