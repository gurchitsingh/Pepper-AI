import { apiFetch } from "./client";
import type { ChatResponse, SavedItem, Token, UserOut } from "./types";

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

export function createNote(content: string, title?: string) {
  return apiFetch<SavedItem>("/saved-items", {
    method: "POST",
    body: JSON.stringify({ source_type: "note", content, title: title || null }),
  });
}

export function getSavedItem(id: string) {
  return apiFetch<SavedItem>(`/saved-items/${id}`);
}

export function createLinkItem(sourceUrl: string) {
  const isYoutube = /(?:youtube\.com|youtu\.be)/i.test(sourceUrl);
  return apiFetch<SavedItem>("/saved-items", {
    method: "POST",
    body: JSON.stringify({
      source_type: isYoutube ? "youtube" : "article",
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

export function chat(question: string) {
  return apiFetch<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}
