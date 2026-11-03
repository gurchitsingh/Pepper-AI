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
} from "lucide-react";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { SavedItem } from "../api/types";
import { Sheet } from "../components/Sheet";
import { relativeTime } from "../lib/format";

type Feedback = { type: "success" | "error"; message: string };

const ENTRY_POINTS = [
  { id: "link", label: "Link", desc: "Save an article, video, or post", Icon: Link2 },
  { id: "note", label: "Note", desc: "Write a quick note", Icon: PenLine },
  { id: "voice", label: "Voice", desc: "Record a voice note", Icon: Mic },
  { id: "click-picture", label: "Camera", desc: "Take a photo", Icon: Camera },
  { id: "add-picture", label: "File", desc: "Upload a PDF, DOCX, TXT, or image", Icon: FileText },
] as const;

type EntryId = (typeof ENTRY_POINTS)[number]["id"];

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
      <h2 className="font-heading text-text-primary text-2xl font-bold">Save</h2>

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

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-5 gap-2">
          {ENTRY_POINTS.map(({ id, label, desc, Icon }) => {
            const isRecording = id === "voice" && recording;
            return (
              <motion.button
                key={id}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleTileTap(id)}
                disabled={uploading}
                title={desc}
                className="flex flex-col items-center gap-2 py-1 disabled:opacity-50"
              >
                <span
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                    isRecording ? "bg-accent text-accent-contrast" : "bg-tint text-accent-ink"
                  }`}
                >
                  {isRecording ? <Square size={16} fill="currentColor" /> : <Icon size={20} strokeWidth={1.75} />}
                </span>
                <span className="font-body text-text-primary text-xs font-medium">
                  {isRecording ? <span className="tabular-nums">{formatClock(recordingSeconds)}</span> : label}
                </span>
              </motion.button>
            );
          })}
        </div>
        {recording && (
          <p className="text-accent-ink text-xs font-medium text-center">Recording… tap the mic again to stop</p>
        )}
      </div>

      <div className="flex flex-col gap-3 pt-1">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-text-primary text-lg font-semibold">Recent</h3>
          <Link to="/library" className="text-accent-ink text-sm font-medium hover:underline">
            View all
          </Link>
        </div>

        {recentItems.length > 0 && (
          <div className="flex flex-col">
            {recentItems.map((item, index) => {
              const Icon = ROW_ICON[item.source_type] ?? FileText;
              return (
                <div key={item.id}>
                  {index > 0 && <div className="h-px bg-line ml-12" />}
                  <Link to={`/library/${item.id}`} className="flex gap-3 items-center py-3 hover:opacity-80 transition-opacity">
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
          <Sheet title="Quick Note" centered onClose={() => setOpenModal(null)}>
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
                rows={8}
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
          <Sheet title="Paste Link" centered onClose={() => setOpenModal(null)}>
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
