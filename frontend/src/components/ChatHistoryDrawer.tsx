import { useEffect, useState } from "react";
import { History, Trash2 } from "lucide-react";
import * as api from "../api/endpoints";
import type { ChatSession } from "../api/types";
import { relativeTime } from "../lib/format";
import { Sheet } from "./Sheet";

interface ChatHistoryDrawerProps {
  activeSessionId: string | null;
  onSelect: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

export function ChatHistoryDrawer({ activeSessionId, onSelect, onDelete, onClose }: ChatHistoryDrawerProps) {
  const [sessions, setSessions] = useState<ChatSession[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function load() {
    setLoadError(false);
    setSessions(null);
    api
      .listChatSessions()
      .then(setSessions)
      .catch(() => setLoadError(true));
  }

  useEffect(load, []);

  async function handleSelect(id: string) {
    if (id === activeSessionId) {
      onClose();
      return;
    }
    setBusyId(id);
    setActionError(null);
    try {
      await onSelect(id);
      onClose();
    } catch {
      setActionError("Couldn't open that conversation. Try again.");
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    setActionError(null);
    try {
      await onDelete(id);
      setSessions((prev) => prev?.filter((s) => s.id !== id) ?? prev);
      setConfirmId(null);
    } catch {
      setActionError("Couldn't delete that conversation. Try again.");
    }
    setBusyId(null);
  }

  return (
    <Sheet title="Chat history" onClose={onClose}>
      {sessions === null && !loadError && (
        <div className="flex flex-col gap-2" role="status" aria-label="Loading conversations">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-bg animate-pulse" />
          ))}
        </div>
      )}

      {loadError && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-text-secondary text-sm">Couldn't load your conversations.</p>
          <button
            type="button"
            onClick={load}
            className="text-sm font-medium px-4 py-1.5 rounded-full border border-text-secondary/20 hover:border-accent hover:text-accent text-text-primary transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {sessions !== null && sessions.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-6 text-text-secondary">
          <History size={24} />
          <p className="text-sm">No past conversations yet</p>
        </div>
      )}

      {sessions !== null && sessions.length > 0 && (
        <ul className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto">
          {sessions.map((s) => {
            const isActive = s.id === activeSessionId;
            const busy = busyId === s.id;
            return (
              <li
                key={s.id}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                  isActive ? "border-accent/60 bg-accent/10" : "border-line bg-surface"
                }`}
              >
                {confirmId === s.id ? (
                  <div className="flex-1 flex items-center justify-between gap-2">
                    <span className="text-text-primary text-sm">Delete this conversation?</span>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmId(null)}
                        className="text-xs font-medium px-3 py-1 rounded-full border border-text-secondary/20 text-text-primary disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDelete(s.id)}
                        className="text-xs font-medium px-3 py-1 rounded-full bg-red-600 text-white disabled:opacity-50"
                      >
                        {busy ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSelect(s.id)}
                      aria-current={isActive ? "true" : undefined}
                      className="flex-1 min-w-0 text-left flex flex-col disabled:opacity-60"
                    >
                      <span className="text-text-primary text-sm font-medium truncate">
                        {s.title || "Untitled conversation"}
                      </span>
                      <span className="text-text-secondary text-xs">
                        {isActive ? "Current · " : ""}
                        {relativeTime(s.updated_at)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setConfirmId(s.id);
                      }}
                      aria-label={`Delete conversation ${s.title || "Untitled conversation"}`}
                      className="shrink-0 text-text-secondary hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {actionError && <p className="text-red-500 text-sm">{actionError}</p>}
    </Sheet>
  );
}
