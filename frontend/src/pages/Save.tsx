import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Mic,
  PenLine,
  FileText,
  Link2,
  PlayCircle,
  Square,
  X,
  ArrowRight,
} from "lucide-react";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { SavedItem } from "../api/types";
import { relativeTime } from "../lib/format";
import { DURATION_ENTER, DURATION_EXIT, EASE_IN, EASE_OUT } from "../lib/motion";

type Feedback = { type: "success" | "error"; message: string };

interface SheetProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function Sheet({ title, onClose, children }: SheetProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: DURATION_ENTER, ease: EASE_OUT } }}
      exit={{ opacity: 0, transition: { duration: DURATION_EXIT, ease: EASE_IN } }}
      className="fixed inset-0 z-[60] bg-black/55 flex items-end justify-center p-3"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-card rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-text-primary text-lg font-bold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-text-secondary hover:text-accent-ink">
            <X size={20} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

const ENTRY_POINTS = [
  { id: "click-picture", label: "Camera", desc: "Snap it with your camera", Icon: Camera },
  { id: "voice", label: "Voice", desc: "Speak it — Pepper transcribes as you go", Icon: Mic },
  { id: "note", label: "Notes", desc: "Jot it down before it slips away", Icon: PenLine },
  { id: "link", label: "Links", desc: "Drop in an article, video, or post", Icon: Link2 },
] as const;

type EntryId = (typeof ENTRY_POINTS)[number]["id"] | "add-picture";

const ROW_ICON: Record<string, typeof FileText> = {
  note: PenLine,
  article: Link2,
  youtube: PlayCircle,
  voice_note: Mic,
  document: FileText,
  instagram: Link2,
  tiktok: Link2,
};

const ROW_LABEL: Record<string, string> = {
  note: "Note",
  article: "Link",
  youtube: "YouTube",
  voice_note: "Voice",
  document: "Document",
  instagram: "Reel",
  tiktok: "Clip",
};

const STATUS_BADGE: Record<SavedItem["status"], string> = {
  ready: "bg-success/15 text-success",
  pending: "bg-text-secondary/15 text-text-secondary",
  processing: "bg-tint text-accent-ink",
  failed: "bg-error/15 text-error",
};

const STATUS_LABEL: Record<SavedItem["status"], string> = {
  ready: "Ready",
  pending: "Pending",
  processing: "Processing",
  failed: "Failed",
};

function detectLinkKind(url: string): string {
  if (/instagram\.com/i.test(url)) return "Instagram reel";
  if (/(?:youtube\.com|youtu\.be)/i.test(url)) return "YouTube video";
  if (/tiktok\.com/i.test(url)) return "TikTok clip";
  return "Article or page";
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Save() {
  const [openModal, setOpenModal] = useState<EntryId | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [recentItems, setRecentItems] = useState<SavedItem[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function refreshRecent() {
    api
      .listSavedItems()
      .then((items) => setRecentItems(items.slice(0, 5)))
      .catch(() => {});
  }

  useEffect(refreshRecent, []);

  useEffect(() => {
    if (!recording) {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setRecordingSeconds(0);
      return;
    }
    recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [recording]);

  function showFeedback(f: Feedback) {
    setFeedback(f);
    setTimeout(() => setFeedback(null), 4000);
  }

  async function handlePictureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const item = await api.uploadSavedItem("document", file, file.name);
      showFeedback({ type: "success", message: `Saved — Pepper's processing it now (${item.status}).` });
      refreshRecent();
    } catch (err) {
      showFeedback({ type: "error", message: err instanceof ApiError ? err.message : "Couldn't save that — try again" });
    } finally {
      setUploading(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setUploading(true);
        try {
          const item = await api.uploadSavedItem("voice_note", blob, "voice-note.webm");
          showFeedback({ type: "success", message: `Voice note saved — Pepper's transcribing it now (${item.status}).` });
          refreshRecent();
        } catch (err) {
          showFeedback({ type: "error", message: err instanceof ApiError ? err.message : "Couldn't save that voice note — try again" });
        } finally {
          setUploading(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      showFeedback({ type: "error", message: "Pepper needs microphone access to record" });
    }
  }

  async function handleNoteSubmit(e: FormEvent) {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setSubmitting(true);
    try {
      await api.createNote(noteContent, noteTitle.trim());
      setNoteTitle("");
      setNoteContent("");
      setOpenModal(null);
      showFeedback({ type: "success", message: "Saved to your library." });
      refreshRecent();
    } catch (err) {
      showFeedback({ type: "error", message: err instanceof ApiError ? err.message : "Couldn't save that note — try again" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLinkSubmit(e: FormEvent) {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    setSubmitting(true);
    try {
      const item = await api.createLinkItem(linkUrl.trim());
      setLinkUrl("");
      setOpenModal(null);
      showFeedback({ type: "success", message: `Saved — Pepper's on it (${item.source_type}).` });
      refreshRecent();
    } catch (err) {
      showFeedback({ type: "error", message: err instanceof ApiError ? err.message : "Couldn't save that link — try again" });
    } finally {
      setSubmitting(false);
    }
  }

  function handleTileTap(id: EntryId) {
    if (id === "click-picture") {
      cameraInputRef.current?.click();
      return;
    }
    if (id === "add-picture") {
      galleryInputRef.current?.click();
      return;
    }
    if (id === "voice") {
      toggleRecording();
      return;
    }
    setOpenModal(id);
  }

  return (
    <div className="max-w-[600px] mx-auto px-6 flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-text-primary text-2xl font-bold">Save to Mind</h2>
        <p className="text-text-secondary text-sm mt-1">Capture instant thoughts, sights, and sounds.</p>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePictureChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={handlePictureChange}
      />

      <AnimatePresence>
        {feedback && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`text-sm ${feedback.type === "success" ? "text-success" : "text-error"}`}
          >
            {feedback.message}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-3">
        {ENTRY_POINTS.map(({ id, label, desc, Icon }) => {
          const isRecording = id === "voice" && recording;
          return (
            <motion.button
              key={id}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleTileTap(id)}
              disabled={uploading}
              title={desc}
              className={`min-h-[124px] border rounded-2xl flex flex-col items-start text-left p-4 gap-1.5 transition-colors disabled:opacity-50 ${
                isRecording ? "bg-tint border-accent ring-2 ring-accent/30" : "bg-surface border-line hover:border-accent/40"
              }`}
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              {isRecording ? (
                <>
                  <div className="w-full flex items-center justify-between">
                    <span className="w-10 h-10 rounded-full bg-accent text-accent-contrast flex items-center justify-center">
                      <Square size={15} fill="currentColor" />
                    </span>
                    <span className="font-heading text-xl font-semibold tabular-nums">{formatClock(recordingSeconds)}</span>
                  </div>
                  <div className="flex items-center gap-[3px] h-5 mt-2.5" aria-hidden>
                    {[6, 12, 18, 10, 16, 8, 14, 20, 9, 13, 7, 11, 16, 6].map((h, i) => (
                      <motion.span
                        key={i}
                        className="w-[3px] rounded-sm bg-accent"
                        style={{ height: h }}
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.06 }}
                      />
                    ))}
                  </div>
                  <span className="font-body text-accent-ink text-xs font-semibold uppercase tracking-wide pt-1">
                    Recording... tap to stop
                  </span>
                </>
              ) : (
                <>
                  <span className="w-10 h-10 rounded-full bg-tint text-accent-ink flex items-center justify-center mb-auto">
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <span className="font-body text-text-primary text-sm font-semibold uppercase tracking-wide pt-3">
                    {label}
                  </span>
                  <span className="font-body text-text-secondary text-xs leading-snug">{desc}</span>
                </>
              )}
            </motion.button>
          );
        })}

        <motion.button
          key="add-picture"
          whileTap={{ scale: 0.97 }}
          onClick={() => handleTileTap("add-picture")}
          disabled={uploading}
          title="Upload a file from your device"
          className="col-span-2 bg-surface border border-line rounded-2xl p-4 flex items-center gap-3.5 disabled:opacity-50 hover:border-accent/40 transition-colors"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <span className="w-10 h-10 shrink-0 rounded-full bg-tint text-accent-ink flex items-center justify-center">
            <FileText size={20} strokeWidth={1.75} />
          </span>
          <span className="flex-1 flex flex-col gap-0.5 text-left">
            <span className="font-body text-text-primary text-sm font-semibold uppercase tracking-wide">Document</span>
            <span className="font-body text-text-secondary text-xs">Upload a file from your device</span>
          </span>
          <span className="font-body text-text-secondary text-[11px] text-right leading-tight shrink-0">
            PDF, DOCX,
            <br />
            TXT, image
          </span>
        </motion.button>
      </div>

      <div className="flex flex-col gap-3 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-heading text-text-primary text-lg font-semibold">Library</h3>
            <p className="text-text-secondary text-sm">Recent captures</p>
          </div>
          <Link
            to="/library"
            className="h-9 rounded-full bg-surface flex items-center gap-1.5 px-3.5 text-accent-ink text-sm font-medium shrink-0"
          >
            View all
            <ArrowRight size={15} />
          </Link>
        </div>

        {recentItems.length > 0 && (
          <div className="bg-surface border border-line rounded-2xl flex flex-col" style={{ boxShadow: "var(--shadow-card)" }}>
            {recentItems.map((item, index) => {
              const Icon = ROW_ICON[item.source_type] ?? FileText;
              return (
                <div key={item.id}>
                  {index > 0 && <div className="h-px bg-line ml-16" />}
                  <Link to={`/library/${item.id}`} className="flex gap-3 items-center px-4 py-3 hover:bg-tint/40 transition-colors rounded-2xl">
                    <span className="w-9 h-9 shrink-0 rounded-[10px] bg-tint text-accent-ink flex items-center justify-center">
                      <Icon size={17} strokeWidth={1.75} />
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="text-text-primary text-sm font-medium truncate">
                        {item.title ?? item.source_url ?? `${ROW_LABEL[item.source_type] ?? item.source_type} item`}
                      </span>
                      <span className="text-text-secondary text-xs">
                        {ROW_LABEL[item.source_type] ?? item.source_type} &middot; {relativeTime(item.created_at)}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${STATUS_BADGE[item.status]}`}
                    >
                      {STATUS_LABEL[item.status]}
                    </span>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {openModal === "note" && (
          <Sheet title="Quick Note" onClose={() => setOpenModal(null)}>
            <form onSubmit={handleNoteSubmit} className="flex flex-col gap-4">
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Title (optional)"
                className="bg-bg border border-line rounded-lg px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent"
              />
              <textarea
                autoFocus
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write it down before it's gone..."
                rows={5}
                className="bg-bg border border-line rounded-lg px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent resize-none"
              />
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={submitting || !noteContent.trim()}
                className="btn-accent font-medium h-12 rounded-full disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save note"}
              </motion.button>
            </form>
          </Sheet>
        )}

        {openModal === "link" && (
          <Sheet title="Paste Link" onClose={() => setOpenModal(null)}>
            <form onSubmit={handleLinkSubmit} className="flex flex-col gap-4">
              <input
                autoFocus
                type="url"
                required
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="bg-bg border border-line rounded-lg px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent"
              />
              {linkUrl.trim() && (
                <div className="flex items-center gap-2 text-text-secondary text-sm">
                  <Link2 size={15} className="text-accent-ink" />
                  {detectLinkKind(linkUrl.trim())}
                </div>
              )}
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={submitting || !linkUrl.trim()}
                className="btn-accent font-medium h-12 rounded-full disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save link"}
              </motion.button>
            </form>
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}
