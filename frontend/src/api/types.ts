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
  folder_id: string | null;
  folder_name: string | null;
  created_at: string;
}

export interface Folder {
  id: string;
  name: string;
  item_count: number;
  created_at: string;
}

export interface UserOut {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  has_avatar: boolean;
}

export interface ChatSource {
  saved_item_id: string;
  title: string | null;
  source_type: string;
  chunk_text: string;
  start_time: number | null;
  end_time: number | null;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
}

export interface SuggestedQuestionsOut {
  questions: string[];
}

export interface InsightsTypeBreakdown {
  source_type: string;
  count: number;
}

export interface InsightsFolderBreakdown {
  folder_id: string | null;
  folder_name: string;
  count: number;
}

export interface InsightsTrendPoint {
  date: string;
  count: number;
}

export interface Insights {
  total_items: number;
  ready_items: number;
  processing_items: number;
  failed_items: number;
  by_type: InsightsTypeBreakdown[];
  by_folder: InsightsFolderBreakdown[];
  trend: InsightsTrendPoint[];
  first_saved_at: string | null;
}

export interface WebSource {
  title: string | null;
  url: string;
  content: string | null;
}

export type ChatStreamEvent =
  | { type: "chunk"; text: string }
  | {
      type: "done";
      sources: ChatSource[];
      web_sources: WebSource[];
      answer_source: "saved_content" | "web_search";
    }
  | { type: "error"; detail: string };
