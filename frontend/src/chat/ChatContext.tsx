import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { ChatSource } from "../api/types";

const HISTORY_KEY = "pepper_chat_history";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
}

interface ChatContextValue {
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  newSession: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
  }, [messages]);

  function newSession() {
    setMessages([]);
  }

  return (
    <ChatContext.Provider value={{ messages, setMessages, newSession }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
