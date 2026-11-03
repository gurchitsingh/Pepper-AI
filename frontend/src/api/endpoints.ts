import { ApiError, apiFetch, apiFetchBlob, apiFetchSse } from "./client";
import type { BillingStatus, ChatMessageCreate, ChatResponse, ChatSession, ChatSessionDetail, ChatSessionMessage, ChatStreamEvent, Folder, Insights, SavedItem, SuggestedQuestionsOut, Token, UserOut } from "./types";

export function signup(email: string, password: string, username: string, name?: string) {
  return apiFetch<Token>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, username, name: name || null }),
  });
}

export function login(email: string, password: string) {
  return apiFetch<Token>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function verifyEmail(email: string, code: string) {
  return apiFetch<Token>("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export function resendVerificationCode(email: string) {
  return apiFetch<void>("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function googleLogin(idToken: string) {
  return apiFetch<Token>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken }),
  });
}

export function getMe() {
  return apiFetch<UserOut>("/auth/me");
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiFetch<void>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export function uploadAvatar(blob: Blob) {
  const form = new FormData();
  form.append("file", blob, "avatar.jpg");
  return apiFetch<UserOut>("/auth/avatar", {
    method: "POST",
    body: form,
  });
}

export function getAvatar() {
  return apiFetchBlob("/auth/avatar");
}

export function updateMe(payload: {
  name?: string;
  email?: string;
  username?: string;
  theme?: string;
  interests?: string[];
  referral_source?: string;
  onboarding_completed?: boolean;
}) {
  return apiFetch<UserOut>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function createNote(content: string, title?: string) {
  return apiFetch<SavedItem>("/saved-items", {
    method: "POST",
    body: JSON.stringify({ source_type: "note", content, title: title || null }),
  });
}

export function getSavedItem(id: string) {
  return apiFetch<SavedItem>(`/saved-items/${id}`);
}

export function getSavedItemAudio(id: string) {
  return apiFetchBlob(`/saved-items/${id}/audio`);
}

export function createLinkItem(sourceUrl: string) {
  const isYoutube = /(?:youtube\.com|youtu\.be)/i.test(sourceUrl);
  const isInstagram = /instagram\.com/i.test(sourceUrl);
  const isTiktok = /tiktok\.com/i.test(sourceUrl);
  const isFacebook = /(?:facebook\.com|fb\.watch)/i.test(sourceUrl);
  const sourceType = isYoutube
    ? "youtube"
    : isInstagram
      ? "instagram"
      : isTiktok
        ? "tiktok"
        : isFacebook
          ? "facebook"
          : "article";
  return apiFetch<SavedItem>("/saved-items", {
    method: "POST",
    body: JSON.stringify({
      source_type: sourceType,
      source_url: sourceUrl,
    }),
  });
}

export function uploadSavedItem(sourceType: string, file: File | Blob, filename?: string) {
  const form = new FormData();
  form.append("source_type", sourceType);
  form.append("file", file, filename);
  return apiFetch<SavedItem>("/saved-items/upload", {
    method: "POST",
    body: form,
  });
}

export function listSavedItems() {
  return apiFetch<SavedItem[]>("/saved-items");
}

export function searchSavedItems(query: string) {
  return apiFetch<SavedItem[]>(`/saved-items/search?q=${encodeURIComponent(query)}`);
}

export function deleteSavedItem(id: string) {
  return apiFetch<void>(`/saved-items/${id}`, { method: "DELETE" });
}

export function retrySavedItem(id: string) {
  return apiFetch<SavedItem>(`/saved-items/${id}/retry`, { method: "POST" });
}

export function updateSavedItem(id: string, payload: { title?: string | null; content?: string }) {
  return apiFetch<SavedItem>(`/saved-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function listFolders() {
  return apiFetch<Folder[]>("/folders");
}

export function recomputeFolders() {
  return apiFetch<Folder[]>("/folders/recompute", { method: "POST" });
}

export function getInsights() {
  return apiFetch<Insights>("/insights");
}

export async function chat(
  question: string,
  onChunk?: (text: string) => void,
  signal?: AbortSignal,
  sessionId?: string | null,
  onSession?: (sessionId: string) => void,
): Promise<ChatResponse> {
  const result: ChatResponse = { answer: "", sources: [], web_sources: [], answer_source: null, session_id: sessionId ?? null };
  await apiFetchSse<ChatStreamEvent>("/chat", {
    method: "POST",
    body: JSON.stringify({ question, session_id: sessionId ?? null }),
    signal,
  }, (event) => {
    if (event.type === "session") {
      result.session_id = event.session_id;
      onSession?.(event.session_id);
    } else if (event.type === "chunk") {
      result.answer += event.text;
      onChunk?.(event.text);
    } else if (event.type === "done") {
      result.sources = event.sources;
      result.web_sources = event.web_sources;
      result.answer_source = event.answer_source;
      result.session_id = event.session_id ?? result.session_id;
    } else {
      throw new ApiError(500, event.detail);
    }
  });
  return result;
}

export function listChatSessions() {
  return apiFetch<ChatSession[]>("/chat/sessions");
}

export function getChatSession(id: string) {
  return apiFetch<ChatSessionDetail>(`/chat/sessions/${id}`);
}

export function createChatSession() {
  return apiFetch<ChatSession>("/chat/sessions", { method: "POST" });
}

export function appendChatMessage(id: string, payload: ChatMessageCreate) {
  return apiFetch<ChatSessionMessage>(`/chat/sessions/${id}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteChatSession(id: string) {
  return apiFetch<void>(`/chat/sessions/${id}`, { method: "DELETE" });
}

export function getSuggestedQuestions() {
  return apiFetch<SuggestedQuestionsOut>("/chat/suggested-questions");
}

export function getBillingStatus() {
  return apiFetch<BillingStatus>("/billing/status");
}
