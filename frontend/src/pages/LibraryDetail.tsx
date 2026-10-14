import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, FileText, Link2, Mic, FileImage, Trash2, Pencil, Folder as FolderIcon } from "lucide-react";
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

  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

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

  function handleRetry() {
    if (!id) return;
    setRetrying(true);
    setRetryError(null);
    api
      .retrySavedItem(id)
      .then(setItem)
      .catch((err) => setRetryError(err instanceof ApiError ? err.message : "Failed to retry"))
      .finally(() => setRetrying(false));
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

  return (
    <div className="max-w-[700px] mx-auto px-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link to="/library" className="flex items-center gap-1 text-text-secondary hover:text-accent w-fit text-sm">
          <ArrowLeft size={16} />
          Back to Library
        </Link>

        {item && !editing && (
          <div className="flex items-center gap-4">
            <button
              onClick={startEditing}
              aria-label="Edit item"
              className="flex items-center gap-1.5 text-text-secondary text-sm hover:text-accent"
            >
              <Pencil size={16} />
              Edit
            </button>
            <button
              onClick={() => setConfirmingDelete(true)}
              aria-label="Delete item"
              className="flex items-center gap-1.5 text-error text-sm hover:opacity-80"
            >
              <Trash2 size={16} />
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
        <div className="bg-surface border border-text-secondary/15 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-bg flex items-center justify-center shrink-0">
              <Icon size={18} className="text-accent" />
            </div>
            <span className="text-[11px] text-text-secondary font-semibold uppercase tracking-widest">
              {item.source_type}
            </span>
            {item.folder_name && (
              <span className="flex items-center gap-1 text-xs text-accent bg-bg rounded-full px-2.5 py-1 ml-auto">
                <FolderIcon size={12} />
                {item.folder_name}
              </span>
            )}
          </div>

          {editing ? (
            <input
              type="text"
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title (optional)"
              className="bg-bg border border-text-secondary/20 rounded-lg px-4 py-3 text-text-primary font-heading text-xl font-semibold outline-none focus:ring-2 focus:ring-accent"
            />
          ) : (
            item.title && <h2 className="font-heading text-text-primary text-2xl font-semibold">{item.title}</h2>
          )}

          {item.source_url && (
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent text-sm break-all hover:underline"
            >
              {item.source_url}
            </a>
          )}

          {item.failure_reason && (
            <div className="flex flex-col gap-2">
              <p className="text-error text-sm">{item.failure_reason}</p>
              {retryError && <p className="text-error text-sm">{retryError}</p>}
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="self-start h-9 px-4 rounded-full bg-accent text-accent-contrast text-sm font-medium disabled:opacity-50"
              >
                {retrying ? "Retrying..." : "Retry"}
              </button>
            </div>
          )}

          {item.source_type === "voice_note" && (
            audioUrl ? (
              <audio controls src={audioUrl} className="w-full">
                Your browser does not support the audio element.
              </audio>
            ) : audioError ? (
              <p className="text-error text-sm">{audioError}</p>
            ) : (
              <p className="text-text-secondary text-sm">Loading audio...</p>
            )
          )}

          {item.status !== "failed" && (
            item.status !== "ready" ? (
              <p className="text-text-secondary text-sm">Still processing ({item.status})...</p>
            ) : editing && item.source_type === "note" ? (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={8}
                className="bg-bg border border-text-secondary/20 rounded-lg px-4 py-3 text-text-primary font-body outline-none focus:ring-2 focus:ring-accent resize-none"
              />
            ) : item.transcript ? (
              <p className="font-body text-text-primary whitespace-pre-wrap leading-relaxed">{item.transcript}</p>
            ) : (


              <p className="text-text-secondary text-sm italic">Pepper couldn't find any text in this one.</p>

            )
          )}

          {editing && (
            <div className="flex gap-3">
              <button
                onClick={cancelEditing}
                disabled={saving}
                className="flex-grow h-11 rounded-full bg-surface text-text-secondary border border-text-secondary/20 disabled:opacity-50"
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
                  className="flex-grow h-11 rounded-full bg-surface text-text-secondary border border-text-secondary/20 disabled:opacity-50"
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
