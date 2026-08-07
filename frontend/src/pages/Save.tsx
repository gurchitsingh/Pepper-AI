import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Mic, NotebookPen, FileText, Link2, Square, X } from "lucide-react";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { SavedItem } from "../api/types";
import { SavedItemCard } from "../components/SavedItemCard";

type Feedback = { type: "success" | "error"; message: string };

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
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
          <button onClick={onClose} className="text-text-secondary hover:text-accent">
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
  { id: "note", label: "Notes", desc: "Jot it down before it slips away", Icon: NotebookPen },
  { id: "link", label: "Links", desc: "Drop in an article, video, or post", Icon: Link2 },
  { id: "add-picture", label: "Document", desc: "Upload a file from your device", Icon: FileText },
] as const;

type EntryId = (typeof ENTRY_POINTS)[number]["id"];

export function Save() {
  const [openModal, setOpenModal] = useState<EntryId | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recentItems, setRecentItems] = useState<SavedItem[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .listSavedItems()
      .then((items) => setRecentItems(items.slice(0, 2)))
      .catch(() => {});
  }, []);

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

      <div className="grid grid-cols-2 gap-4">
        {ENTRY_POINTS.map(({ id, label, desc, Icon }, index) => {
          const isRecording = id === "voice" && recording;
          const isLast = index === ENTRY_POINTS.length - 1;
          return (
            <motion.button
              key={id}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTileTap(id)}
              disabled={uploading}
              title={desc}
              className={`bg-surface border rounded-2xl flex flex-col items-center justify-center p-6 min-h-[140px] text-center transition-colors disabled:opacity-50 ${
                isRecording ? "border-accent ring-2 ring-accent" : "border-text-secondary/15 hover:border-accent/40"
              } ${isLast ? "col-span-2" : ""}`}
            >
              {isRecording ? (
                <Square size={22} className="text-accent mb-2" fill="currentColor" />
              ) : (
                <Icon size={22} className="text-accent mb-2" strokeWidth={1.5} />
              )}
              <h3 className="font-body text-text-primary text-sm font-semibold uppercase tracking-wide">
                {isRecording ? "Recording... tap to stop" : label}
              </h3>
            </motion.button>
          );
        })}
      </div>

      {recentItems.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-text-primary text-lg font-semibold">Recent Captures</h3>
            <Link to="/library" className="text-accent text-sm hover:underline">
              View All
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentItems.map((item) => (
              <SavedItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {openModal === "note" && (
          <Modal title="Quick Note" onClose={() => setOpenModal(null)}>
            <form onSubmit={handleNoteSubmit} className="flex flex-col gap-4">
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Title (optional)"
                className="bg-surface border border-text-secondary/20 rounded-lg px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent"
              />
              <textarea
                autoFocus
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write it down before it's gone..."
                rows={5}
                className="bg-surface border border-text-secondary/20 rounded-lg px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent resize-none"
              />
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={submitting || !noteContent.trim()}
                className="bg-accent text-accent-contrast font-medium h-12 rounded-full disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save note"}
              </motion.button>
            </form>
          </Modal>
        )}

        {openModal === "link" && (
          <Modal title="Paste Link" onClose={() => setOpenModal(null)}>
            <form onSubmit={handleLinkSubmit} className="flex flex-col gap-4">
              <input
                autoFocus
                type="url"
                required
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="bg-surface border border-text-secondary/20 rounded-lg px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent"
              />
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={submitting || !linkUrl.trim()}
                className="bg-accent text-accent-contrast font-medium h-12 rounded-full disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save link"}
              </motion.button>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
