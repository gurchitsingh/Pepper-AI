export interface Token {
  access_token: string;
  token_type: string;
}

export interface SavedItem {
  id: string;
  source_type: string;
  source_url: string | null;
  title: string | null;
  status: "pending" | "processing" | "ready" | "failed";
  failure_reason: string | null;
  transcript: string | null;
  duration_seconds: number | null;
  created_at: string;
}
