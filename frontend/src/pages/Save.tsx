import { useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, ImagePlus, Mic, FileText, Link2, Square, X } from "lucide-react";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";

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
  { id: "click-picture", label: "Click a Picture", desc: "Capture with your camera", Icon: Camera },
  { id: "add-picture", label: "Add a Picture", desc: "Choose an existing photo", Icon: ImagePlus },
  { id: "voice", label: "Voice Note", desc: "Record and auto-transcribe", Icon: Mic },
  { id: "note", label: "Quick Note", desc: "Type a fleeting thought", Icon: FileText },
  { id: "link", label: "Paste Link", desc: "Save an article or video", Icon: Link2 },
] as const;

type EntryId = (typeof ENTRY_POINTS)[number]["id"];

export function Save() {
  const [openModal, setOpenModal] = useState<EntryId | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      showFeedback({ type: "success", message: `Captured — processing (${item.status}).` });
    } catch (err) {
      showFeedback({ type: "error", message: err instanceof ApiError ? err.message : "Capture failed" });
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
          showFeedback({ type: "success", message: `Voice note saved — processing (${item.status}).` });
        } catch (err) {
          showFeedback({ type: "error", message: err instanceof ApiError ? err.message : "Upload failed" });
        } finally {
          setUploading(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      showFeedback({ type: "error", message: "Microphone access denied" });
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
      showFeedback({ type: "success", message: "Note saved." });
    } catch (err) {
      showFeedback({ type: "error", message: err instanceof ApiError ? err.message : "Failed to save note" });
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
      showFeedback({ type: "success", message: `Link saved as ${item.source_type} — processing.` });
    } catch (err) {
      showFeedback({ type: "error", message: err instanceof ApiError ? err.message : "Failed to save link" });
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
    <div className="max-w-[600px] mx-auto px-6 flex flex-col gap-4">
      <h2 className="font-heading text-text-primary text-2xl font-bold mb-2">Save something</h2>

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
        accept="image/*"
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
        {ENTRY_POINTS.map(({ id, label, desc, Icon }) => {
          const isRecording = id === "voice" && recording;
          return (
            <motion.button
              key={id}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTileTap(id)}
              disabled={uploading}
              className={`glass-card rounded-2xl flex flex-col items-center justify-center p-6 min-h-[160px] text-center transition-colors disabled:opacity-50 ${
                isRecording ? "ring-2 ring-accent" : ""
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-bg flex items-center justify-center mb-3">
                {isRecording ? (
                  <Square size={20} className="text-accent" fill="currentColor" />
                ) : (
                  <Icon size={22} className="text-accent" />
                )}
              </div>
              <h3 className="font-body text-text-primary font-medium">
                {isRecording ? "Recording... tap to stop" : label}
              </h3>
              <p className="font-body text-text-secondary text-xs mt-1">{desc}</p>
            </motion.button>
          );
        })}
      </div>

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
                placeholder="Capture a fleeting insight..."
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
