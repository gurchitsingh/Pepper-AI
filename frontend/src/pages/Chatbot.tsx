import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, animate, motion } from "framer-motion";
import { Send, FileText, Link2, Mic, FileImage, Plus, ChevronDown } from "lucide-react";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { ChatSource, SavedItem } from "../api/types";
import { useChat, type Message } from "../chat/ChatContext";
import { detectSmallTalk, timeOfDayGreeting } from "../chat/smallTalk";
import { suggestedQuestions, suggestedQuestionsFromContent } from "../chat/suggestedQuestions";
import { ThinkingIndicator } from "../components/ThinkingIndicator";
import { CompleteIndicator } from "../components/CompleteIndicator";
import { MarkdownMessage } from "../components/MarkdownMessage";
import { ExpandableSearch } from "../components/ExpandableSearch";
import { Mark } from "../components/Mark";
import { EASE_OUT } from "../lib/motion";

const COMPLETE_INDICATOR_FADE_MS = 1700;
const COMPLETE_INDICATOR_TOTAL_MS = 2000;

const TYPE_ICON: Record<string, typeof FileText> = {
  note: FileText,
  article: Link2,
  youtube: Link2,
  voice_note: Mic,
  document: FileImage,
  instagram: Link2,
  tiktok: Link2,
  facebook: Link2,
};

const NEAR_BOTTOM_THRESHOLD_PX = 80;

const TYPE_LABEL: Record<string, string> = {
  note: "Note",
  article: "Article",
  youtube: "YouTube",
  voice_note: "Voice note",
  document: "Document",
  instagram: "Reel",
  tiktok: "Reel",
};

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// getSuggestedQuestions() calls Gemini, which is often on a tight free-tier daily
// quota. Without this cache, every mount of this page (i.e. every time the user
// taps the Chat tab) fired a fresh request, burning quota before the user asked a
// single real question. Module-level state survives across mounts for the life of
// the page load, so repeated visits within the TTL reuse the same result.
const SUGGESTED_QUESTIONS_CACHE_TTL_MS = 10 * 60 * 1000;
let suggestedQuestionsCache: { questions: string[]; fetchedAt: number } | null = null;
// Dedupes concurrent fetches too -- React StrictMode's dev-only double-invoke of
// effects would otherwise fire two requests back-to-back before the first's
// result lands and populates the cache above.
let suggestedQuestionsInFlight: Promise<string[]> | null = null;

function SourceCard({ source }: { source: ChatSource }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TYPE_ICON[source.source_type] ?? FileText;
  const typeLabel = TYPE_LABEL[source.source_type] ?? source.source_type;
  const metaLine = source.start_time != null ? `${typeLabel} · at ${formatTimestamp(source.start_time)}` : typeLabel;

  return (
    <motion.button
      layout
      whileTap={{ scale: 0.98 }}
      onClick={() => setExpanded((e) => !e)}
      className="bg-surface border border-line hover:border-accent/40 rounded-xl px-3 py-2.5 text-left w-full flex flex-col gap-1.5 transition-colors"
    >
      <div className="flex items-center gap-2.5">
        <span className="w-7 h-7 rounded-full bg-bg flex items-center justify-center shrink-0 text-accent-ink">
          <Icon size={14} />
        </span>
        <div className="flex-1 min-w-0 flex flex-col">
          <span className="text-text-primary text-[13px] font-medium truncate">
            {source.title || `${source.source_type} item`}
          </span>
          <span className="text-text-secondary text-xs">{metaLine}</span>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-text-secondary text-xs overflow-hidden"
          >
            {source.chunk_text}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function Chatbot() {
  const { messages, setMessages, newSession } = useChat();
  const location = useLocation();
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [contentSuggestions, setContentSuggestions] = useState<string[]>([]);
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);
  const [completeFading, setCompleteFading] = useState(false);
  const completeTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [messageQuery, setMessageQuery] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  // While a programmatic smooth-scroll is in flight, the scroll events it
  // generates fire handleScroll with intermediate (still far-from-bottom)
  // positions; without this guard those events flip showScrollButton back
  // on and it can get stuck since the final settle doesn't always re-fire.
  const autoScrollingRef = useRef(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  // Tracks the in-flight /chat request so "New Chat" (and a fresh question) can
  // cancel a stalled one instead of leaving `loading` stuck true forever, which
  // would otherwise silently block every later message for the rest of the session.
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    api
      .listSavedItems()
      .then(setSavedItems)
      .catch(() => {});

    const isFresh = suggestedQuestionsCache && Date.now() - suggestedQuestionsCache.fetchedAt < SUGGESTED_QUESTIONS_CACHE_TTL_MS;
    if (isFresh) {
      setContentSuggestions(suggestedQuestionsCache!.questions);
      return;
    }
    if (!suggestedQuestionsInFlight) {
      suggestedQuestionsInFlight = api
        .getSuggestedQuestions()
        .then((res) => {
          suggestedQuestionsCache = { questions: res.questions, fetchedAt: Date.now() };
          return res.questions;
        })
        .finally(() => {
          suggestedQuestionsInFlight = null;
        });
    }
    suggestedQuestionsInFlight.then(setContentSuggestions).catch(() => {});
  }, []);

  useEffect(() => {
    const prefillQuestion = (location.state as { prefillQuestion?: string } | null)?.prefillQuestion;
    if (!prefillQuestion) return;
    navigate(location.pathname, { replace: true, state: null });
    submitQuestion(prefillQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  function smoothScrollToBottom(el: HTMLDivElement) {
    autoScrollingRef.current = true;
    const target = el.scrollHeight - el.clientHeight;
    animate(el.scrollTop, target, {
      duration: 0.4,
      ease: EASE_OUT,
      onUpdate: (v) => {
        el.scrollTop = v;
      },
      onComplete: () => {
        autoScrollingRef.current = false;
        nearBottomRef.current = true;
        setShowScrollButton(false);
      },
    });
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (nearBottomRef.current) {
      smoothScrollToBottom(el);
    } else {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollButton(distanceFromBottom > NEAR_BOTTOM_THRESHOLD_PX);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, loading]);

  const suggestions = useMemo(() => {
    const contentBased = suggestedQuestionsFromContent(contentSuggestions, messages);
    return contentBased.length > 0 ? contentBased : suggestedQuestions(savedItems, messages);
  }, [contentSuggestions, savedItems, messages]);

  useEffect(() => {
    return () => {
      completeTimeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  function flashComplete(messageId: string) {
    completeTimeoutsRef.current.forEach(clearTimeout);
    setCompleteFading(false);
    setJustCompletedId(messageId);
    completeTimeoutsRef.current = [
      setTimeout(() => setCompleteFading(true), COMPLETE_INDICATOR_FADE_MS),
      setTimeout(() => {
        setJustCompletedId(null);
        setCompleteFading(false);
      }, COMPLETE_INDICATOR_TOTAL_MS),
    ];
  }

  // Client-side search over this conversation's own message history only --
  // intentionally not routed through the saved-items search endpoint.
  const trimmedMessageQuery = messageQuery.trim();
  const isSearchMode = trimmedMessageQuery.length > 0;
  const filteredMessages = useMemo(() => {
    if (!trimmedMessageQuery) return [];
    const q = trimmedMessageQuery.toLowerCase();
    return messages.filter((m) => m.content.toLowerCase().includes(q));
  }, [messages, trimmedMessageQuery]);

  function handleScroll() {
    if (autoScrollingRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX;
    nearBottomRef.current = nearBottom;
    setShowScrollButton(!nearBottom);
  }

  function scrollToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    smoothScrollToBottom(el);
  }

  async function submitQuestion(raw: string) {
    const q = raw.trim();
    if (!q || loading) return;

    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: q };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");

    const smallTalk = detectSmallTalk(q);
    if (smallTalk) {
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 250));
      const replyId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: replyId, role: "assistant", content: smallTalk.reply }]);
      setLoading(false);
      flashComplete(replyId);
      return;
    }

    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;

    setLoading(true);
    const replyId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: replyId, role: "assistant", content: "" }]);
    try {
      const res = await api.chat(q, (chunk) => {
        setMessages((prev) => prev.map((message) => (
          message.id === replyId ? { ...message, content: message.content + chunk } : message
        )));
      }, controller.signal);
      setMessages((prev) => prev.map((message) => (
        message.id === replyId ? { ...message, content: res.answer, sources: res.sources } : message
      )));
      flashComplete(replyId);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof ApiError ? err.message : "Pepper couldn't answer that — try again.";
      setMessages((prev) => prev.map((chatMessage) => (
        chatMessage.id === replyId ? { ...chatMessage, content: message } : chatMessage
      )));
      flashComplete(replyId);
    } finally {
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        setLoading(false);
      }
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submitQuestion(question);
  }

  function handleNewChat() {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    setLoading(false);
    newSession();
  }

  return (
    <div className="fixed inset-x-0 top-16 bottom-[72px] max-w-[700px] mx-auto w-full px-6 pt-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-text-primary text-2xl font-bold">Chat with Pepper</h2>
        <button
          type="button"
          onClick={handleNewChat}
          disabled={messages.length === 0 && !loading}
          className="flex items-center gap-1 text-text-primary text-sm font-medium px-3.5 py-1.5 rounded-full border border-text-secondary/20 hover:border-accent hover:text-accent disabled:opacity-40 transition-colors"
        >
          <Plus size={14} />
          New Chat
        </button>
      </div>

      <div className="flex justify-end">
        <ExpandableSearch
          value={messageQuery}
          onChange={setMessageQuery}
          placeholder="Search this conversation..."
          ariaLabel="Search this conversation"
        />
      </div>

      <div className="relative flex-grow min-h-0">
        <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto flex flex-col gap-4 pb-2">
          {isSearchMode ? (
            <>
              <h3 className="font-heading text-text-primary text-sm font-semibold uppercase tracking-wide">
                Search results
              </h3>
              {filteredMessages.length === 0 && (
                <p className="text-text-secondary text-sm">No messages match &ldquo;{trimmedMessageQuery}&rdquo;.</p>
              )}
              {filteredMessages.map((m) => (
                <div key={m.id} className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <span className="text-text-secondary text-xs uppercase tracking-wide">
                    {m.role === "user" ? "You" : "Pepper"}
                  </span>
                  {m.role === "user" ? (
                    <div className="rounded-2xl px-4 py-3 max-w-[85%] bg-accent text-accent-contrast">
                      {m.content}
                    </div>
                  ) : (
                    <MarkdownMessage content={m.content} />
                  )}
                </div>
              ))}
            </>
          ) : (
            <>
              {messages.length === 0 && (
                <div className="flex items-start gap-3">
                  <Mark size={32} className="shrink-0 mt-0.5" />
                  <div className="glass-card rounded-2xl p-5 flex flex-col gap-2 min-w-0">
                    <p className="font-heading text-text-primary text-lg font-semibold">
                      {timeOfDayGreeting()} I'm Pepper.
                    </p>
                    <p className="text-text-secondary text-sm">
                      Ask me anything about what you've saved, or just say hello — I'm around either way.
                    </p>
                  </div>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex ${m.role === "user" ? "justify-end" : "items-start gap-3"}`}
                  >
                    {m.role === "assistant" && <Mark size={32} className="shrink-0 mt-0.5" />}
                    <div className={`flex flex-col gap-2 min-w-0 ${m.role === "user" ? "items-end" : "items-start"}`}>
                      {m.role === "user" ? (
                        <div className="rounded-2xl px-4 py-3 max-w-[85%] bg-accent text-accent-contrast">
                          {m.content}
                        </div>
                      ) : (
                        <MarkdownMessage content={m.content} />
                      )}
                      {m.role === "assistant" && justCompletedId === m.id && (
                        <CompleteIndicator fading={completeFading} />
                      )}
                      {m.sources && m.sources.length > 0 && (
                        <div className="flex flex-col gap-2 max-w-[85%] w-full">
                          <span className="text-text-secondary text-[11px] font-medium uppercase tracking-widest">
                            From {m.sources.length} of your saves
                          </span>
                          {m.sources.map((s, i) => (
                            <SourceCard key={`${m.id}-${i}`} source={s} />
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              <AnimatePresence>
                {loading && (
                  <motion.div
                    key="thinking"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.25 }}
                  >
                    <ThinkingIndicator savedCount={savedItems.length} />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        <AnimatePresence>
          {!isSearchMode && showScrollButton && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              whileTap={{ scale: 0.92 }}
              onClick={scrollToBottom}
              aria-label="Scroll to latest message"
              className="absolute bottom-3 right-3 w-10 h-10 rounded-full glass-card shadow-lg flex items-center justify-center text-text-primary"
            >
              <ChevronDown size={18} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {suggestions.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              disabled={loading}
              onClick={() => submitQuestion(q)}
              className="shrink-0 text-xs text-text-secondary glass-card rounded-full px-3 py-2 hover:text-text-primary transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 pb-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about what you've saved..."
          className="flex-grow bg-surface border border-text-secondary/20 rounded-full px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-accent"
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          type="submit"
          disabled={loading || !question.trim()}
          className="w-12 h-12 rounded-full btn-accent flex items-center justify-center shrink-0 disabled:opacity-50"
        >
          <Send size={18} />
        </motion.button>
      </form>
    </div>
  );
}
