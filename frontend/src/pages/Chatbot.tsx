import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, FileText, Link2, Mic, FileImage } from "lucide-react";
import * as api from "../api/endpoints";
import { ApiError } from "../api/client";
import type { ChatSource } from "../api/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
}

const TYPE_ICON: Record<string, typeof FileText> = {
  note: FileText,
  article: Link2,
  youtube: Link2,
  voice_note: Mic,
  document: FileImage,
  instagram: Link2,
  tiktok: Link2,
};

function SourceCard({ source }: { source: ChatSource }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TYPE_ICON[source.source_type] ?? FileText;

  return (
    <motion.button
      layout
      whileTap={{ scale: 0.97 }}
      onClick={() => setExpanded((e) => !e)}
      className="glass-card rounded-xl p-3 text-left w-full flex flex-col gap-1"
    >
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-accent shrink-0" />
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: q };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await api.chat(q);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: res.answer, sources: res.sources },
      ]);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong asking Pepper.";
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-[700px] mx-auto px-6 flex flex-col gap-4 h-[calc(100vh-14rem)]">
      <h2 className="font-heading text-text-primary text-2xl font-bold">Chat with Pepper</h2>

      <div className="flex-grow overflow-y-auto flex flex-col gap-4 pb-2">
        {messages.length === 0 && (
          <p className="text-text-secondary text-sm">
            Ask a question — Pepper answers using everything you've saved.
          </p>
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
              <div
                className={`rounded-2xl px-4 py-3 max-w-[85%] ${
                  m.role === "user" ? "bg-accent text-accent-contrast" : "glass-card text-text-primary"
                }`}
              >
                {m.content}
              </div>
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

        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl px-4 py-3 text-text-secondary text-sm w-fit"
          >
            Thinking...
          </motion.div>
        )}
      </div>

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
          className="w-12 h-12 rounded-full bg-accent text-accent-contrast flex items-center justify-center shrink-0 disabled:opacity-50"
        >
          <Send size={18} />
        </motion.button>
      </form>
    </div>
  );
}
