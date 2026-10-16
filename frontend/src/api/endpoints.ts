import { ApiError, apiFetch, apiFetchBlob, apiFetchSse } from "./client";
import type { BillingStatus, ChatResponse, ChatStreamEvent, Folder, Insights, SavedItem, SuggestedQuestionsOut, Token, UserOut } from "./types";

export function signup(email: string, password: string, name?: string) {
  return apiFetch<Token>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, name: name || null }),
  });
}

export function login(email: string, password: string) {
  return apiFetch<Token>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
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

export function updateMe(payload: { name?: string; email?: string }) {
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

export async function chat(question: string, onChunk?: (text: string) => void, signal?: AbortSignal): Promise<ChatResponse> {
  let answer = "";
  let sources: ChatResponse["sources"] = [];
  await apiFetchSse<ChatStreamEvent>("/chat", {
    method: "POST",
    body: JSON.stringify({ question }),
    signal,
  }, (event) => {
    if (event.type === "chunk") {
      answer += event.text;
      onChunk?.(event.text);
    } else if (event.type === "done") {
      sources = event.sources;
    } else {
      throw new ApiError(500, event.detail);
    }
  });
  return { answer, sources };
}

export function getSuggestedQuestions() {
  return apiFetch<SuggestedQuestionsOut>("/chat/suggested-questions");
}

export function getBillingStatus() {
  return apiFetch<BillingStatus>("/billing/status");
}
