import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
};

const NEAR_BOTTOM_THRESHOLD_PX = 80;

function SourceCard({ source }: { source: ChatSource }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TYPE_ICON[source.source_type] ?? FileText;

  return (
    <motion.button
      layout
      whileTap={{ scale: 0.97 }}
      onClick={() => setExpanded((e) => !e)}
      className="bg-surface border border-text-secondary/15 hover:border-accent/40 rounded-xl p-3 text-left w-full flex flex-col gap-1 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-bg flex items-center justify-center shrink-0">
          <Icon size={13} className="text-accent" />
        </span>
        <span className="text-text-primary text-sm font-medium truncate">
          {source.title || `${source.source_type} item`}
        </span>
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

  useEffect(() => {
    api
      .listSavedItems()
      .then(setSavedItems)
      .catch(() => {});
    api
      .getSuggestedQuestions()
      .then((res) => setContentSuggestions(res.questions))
      .catch(() => {});
  }, []);

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

    setLoading(true);
    const replyId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: replyId, role: "assistant", content: "" }]);
    try {
      const res = await api.chat(q, (chunk) => {
        setMessages((prev) => prev.map((message) => (
          message.id === replyId ? { ...message, content: message.content + chunk } : message
        )));
      });
      setMessages((prev) => prev.map((message) => (
        message.id === replyId ? { ...message, content: res.answer, sources: res.sources } : message
      )));
      flashComplete(replyId);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Pepper couldn't answer that — try again.";
      setMessages((prev) => prev.map((chatMessage) => (
        chatMessage.id === replyId ? { ...chatMessage, content: message } : chatMessage
      )));
      flashComplete(replyId);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submitQuestion(question);
  }

  return (
    <div className="fixed inset-x-0 top-16 bottom-[72px] max-w-[700px] mx-auto w-full px-6 pt-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-text-primary text-2xl font-bold">Chat with Pepper</h2>
        <button
          type="button"
          onClick={newSession}
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
                <div className="glass-card rounded-2xl p-5 flex flex-col gap-2">
                  <p className="font-heading text-text-primary text-lg font-semibold">
                    {timeOfDayGreeting()} I'm Pepper.
                  </p>
                  <p className="text-text-secondary text-sm">
                    Ask me anything about what you've saved, or just say hello — I'm around either way.
                  </p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex flex-col gap-2 ${m.role === "user" ? "items-end" : "items-start"}`}
                  >
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
                        {m.sources.map((s, i) => (
                          <SourceCard key={`${m.id}-${i}`} source={s} />
                        ))}
                      </div>
                    )}
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
                    <ThinkingIndicator />
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
