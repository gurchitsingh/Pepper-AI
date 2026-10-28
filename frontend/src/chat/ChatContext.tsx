import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from "react";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { AnswerSource, ChatSessionMessage, ChatSource, WebSource } from "../api/types";

// Pre-sessions storage: one flat array for the whole app. Only read now, to import
// a user's in-progress conversation into a real server-side session once.
const LEGACY_HISTORY_KEY = "pepper_chat_history";
const ACTIVE_SESSION_KEY = "pepper_active_session_id";
const ACTIVE_MESSAGES_KEY = "pepper_active_session_messages";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  webSources?: WebSource[];
  answerSource?: AnswerSource;
}

interface ChatContextValue {
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  /** Returns the active session id, creating a server session first if there isn't one. */
  ensureSession: (epoch?: number) => Promise<string>;
  /** Bumped whenever the visible conversation is replaced, so in-flight work can tell it went stale. */
  epochRef: MutableRefObject<number>;
  loadSession: (id: string, beforeSwitch?: () => void) => Promise<void>;
  newSession: () => void;
  deleteSession: (id: string, beforeSwitch?: () => void) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function toMessage(m: ChatSessionMessage): Message {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    sources: m.sources ?? undefined,
    webSources: m.web_sources ?? undefined,
    answerSource: m.answer_source ?? undefined,
  };
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  const [activeSessionId, setActiveId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_SESSION_KEY);
    } catch {
      return null;
    }
  });
  const [messages, setMessages] = useState<Message[]>(() => {
    if (localStorage.getItem(ACTIVE_SESSION_KEY)) return readJson<Message[]>(ACTIVE_MESSAGES_KEY) ?? [];
    // No active session yet: show the old conversation right away while it's imported.
    return readJson<Message[]>(LEGACY_HISTORY_KEY) ?? [];
  });

  const activeIdRef = useRef(activeSessionId);
  const epochRef = useRef(0);

  function setActiveSessionId(id: string | null) {
    activeIdRef.current = id;
    setActiveId(id);
  }

  useEffect(() => {
    try {
      if (activeSessionId) localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
      else localStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch {
      // storage unavailable: the server copy is still the source of truth
    }
  }, [activeSessionId]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_MESSAGES_KEY, JSON.stringify(messages));
    } catch {
      // see above
    }
  }, [messages]);

  useEffect(() => {
    if (!isAuthenticated) {
      // Don't leak one account's conversation into the next login on this browser.
      epochRef.current++;
      setActiveSessionId(null);
      setMessages([]);
      return;
    }

    const epoch = epochRef.current;
    const isCurrent = () => epochRef.current === epoch;

    async function importLegacy(legacy: Message[]) {
      const toImport = legacy.filter((m) => m.content.trim());
      // Claim the key up front so a second run of this effect (StrictMode) can't import twice.
      localStorage.removeItem(LEGACY_HISTORY_KEY);
      if (toImport.length === 0) return;
      try {
        const session = await api.createChatSession();
        for (const m of toImport) {
          await api.appendChatMessage(session.id, {
            role: m.role,
            content: m.content,
            sources: m.sources,
            web_sources: m.webSources,
            answer_source: m.answerSource,
          });
        }
        if (isCurrent() && activeIdRef.current === null) {
          const detail = await api.getChatSession(session.id);
          if (isCurrent() && activeIdRef.current === null) {
            setActiveSessionId(session.id);
            setMessages(detail.messages.map(toMessage));
          }
        }
      } catch {
        // Import failed: put the old data back so the next load retries instead of losing it.
        localStorage.setItem(LEGACY_HISTORY_KEY, JSON.stringify(legacy));
      }
    }

    async function refetchActive(id: string) {
      try {
        const detail = await api.getChatSession(id);
        if (!isCurrent() || activeIdRef.current !== id) return;
        // A reply that was mid-stream at refresh isn't on the server yet; only replace the local
        // copy when the server has at least as much, so that partial reply isn't thrown away.
        setMessages((prev) => (detail.messages.length >= prev.length ? detail.messages.map(toMessage) : prev));
      } catch (err) {
        if (err instanceof ApiError && err.status === 404 && isCurrent() && activeIdRef.current === id) {
          setActiveSessionId(null);
          setMessages([]);
        }
        // Any other failure (offline, 5xx): keep showing the locally stored copy.
      }
    }

    if (activeIdRef.current) {
      refetchActive(activeIdRef.current);
    } else {
      const legacy = readJson<Message[]>(LEGACY_HISTORY_KEY);
      if (legacy && legacy.length > 0) importLegacy(legacy);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  async function ensureSession(epoch?: number): Promise<string> {
    if (activeIdRef.current) return activeIdRef.current;
    const session = await api.createChatSession();
    // If the user switched away while this was in flight, don't hijack the new view.
    if (epoch === undefined || epochRef.current === epoch) setActiveSessionId(session.id);
    return session.id;
  }

  async function loadSession(id: string, beforeSwitch?: () => void) {
    // Fetch first so a failed load leaves the current conversation untouched.
    const detail = await api.getChatSession(id);
    beforeSwitch?.();
    epochRef.current++;
    setActiveSessionId(detail.id);
    setMessages(detail.messages.map(toMessage));
  }

  function newSession() {
    epochRef.current++;
    setActiveSessionId(null);
    setMessages([]);
  }

  async function deleteSession(id: string, beforeSwitch?: () => void) {
    await api.deleteChatSession(id);
    if (activeIdRef.current === id) {
      beforeSwitch?.();
      newSession();
    }
  }

  return (
    <ChatContext.Provider
      value={{
        messages,
        setMessages,
        activeSessionId,
        setActiveSessionId,
        ensureSession,
        epochRef,
        loadSession,
        newSession,
        deleteSession,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
