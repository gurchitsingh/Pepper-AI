import { apiFetch } from "./client";
import type { SavedItem, Token } from "./types";

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

export function createNote(content: string) {
  return apiFetch<SavedItem>("/saved-items", {
    method: "POST",
    body: JSON.stringify({ source_type: "note", content }),
  });
}

export function listSavedItems() {
  return apiFetch<SavedItem[]>("/saved-items");
}
