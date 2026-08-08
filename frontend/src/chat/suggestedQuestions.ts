import type { SavedItem } from "../api/types";
import type { Message } from "./ChatContext";

const QUESTION_TEMPLATES: Record<string, (title: string) => string> = {
  note: (t) => `What did I write in my note about ${t}?`,
  article: (t) => `What's the key takeaway from "${t}"?`,
  youtube: (t) => `What was "${t}" about?`,
  voice_note: (t) => `What did I say in my voice note "${t}"?`,
  document: (t) => `What's in the document "${t}"?`,
  instagram: (t) => `What did I save from "${t}"?`,
  tiktok: (t) => `What did I save from "${t}"?`,
};

function truncate(text: string, max = 40): string {
  const trimmed = text.trim();
  return trimmed.length > max ? trimmed.slice(0, max).trimEnd() + "…" : trimmed;
}

function titleFor(item: SavedItem): string | null {
  if (item.title && item.title.trim()) return item.title.trim();
  if (item.transcript && item.transcript.trim()) return item.transcript.trim();
  return null;
}

/** Picks suggested questions from the user's saved content, shifting the
 * selection as the conversation grows so it doesn't just repeat itself. */
export function suggestedQuestions(items: SavedItem[], messages: Message[], count = 4): string[] {
  const askedText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase())
    .join(" \n ");

  const candidates = items
    .filter((i) => i.status === "ready")
    .map((item) => {
      const title = titleFor(item);
      if (!title) return null;
      const template = QUESTION_TEMPLATES[item.source_type] ?? ((t: string) => `Tell me about "${t}".`);
      return { item, question: template(truncate(title)) };
    })
    .filter((c): c is { item: SavedItem; question: string } => c !== null)
    .filter((c) => {
      const key = (c.item.title ?? c.item.transcript ?? "").toLowerCase().slice(0, 15);
      return !key || !askedText.includes(key);
    });

  if (candidates.length === 0) return [];

  const offset = messages.length % candidates.length;
  const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)];
  return rotated.slice(0, count).map((c) => c.question);
}

/** Same rotate-and-avoid-repeats behavior as suggestedQuestions above, but
 * over a flat list of already-generated question strings (e.g. the
 * content-grounded questions the backend generates from actual saved-item
 * text) rather than title templates. */
export function suggestedQuestionsFromContent(questions: string[], messages: Message[], count = 4): string[] {
  const askedText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase())
    .join(" \n ");

  const candidates = questions.filter((q) => q.trim() && !askedText.includes(q.toLowerCase()));
  if (candidates.length === 0) return [];

  const offset = messages.length % candidates.length;
  const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)];
  return rotated.slice(0, count);
}
