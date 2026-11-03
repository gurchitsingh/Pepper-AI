export interface Token {
  access_token: string;
  token_type: string;
  email_verified: boolean;
  onboarding_completed: boolean;
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
  username: string;
  name: string | null;
  plan: string;
  has_avatar: boolean;
  profile_picture_url: string | null;
  email_verified: boolean;
  auth_provider: string;
  theme_preference: string | null;
  interests: string[] | null;
  referral_source: string | null;
  onboarding_completed: boolean;
}

export interface ChatSource {
  saved_item_id: string;
  title: string | null;
  source_type: string;
  chunk_text: string;
  start_time: number | null;
  end_time: number | null;
}

export type AnswerSource = "saved_content" | "web_search" | "small_talk";

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  web_sources: WebSource[];
  answer_source: AnswerSource | null;
  session_id: string | null;
}

export interface ChatSession {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: ChatSource[] | null;
  web_sources: WebSource[] | null;
  answer_source: AnswerSource | null;
  created_at: string;
}

export interface ChatSessionDetail extends ChatSession {
  messages: ChatSessionMessage[];
}

export interface ChatMessageCreate {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  web_sources?: WebSource[];
  answer_source?: AnswerSource;
}

export interface SuggestedQuestionsOut {
  questions: string[];
}

export interface BillingStatus {
  plan: string;
  short_form_seconds: number;
  long_form_seconds: number;
  total_seconds: number;
  limit_seconds: number | null;
  over_limit: boolean;
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
  | { type: "session"; session_id: string }
  | { type: "chunk"; text: string }
  | {
      type: "done";
      sources: ChatSource[];
      web_sources: WebSource[];
      answer_source: "saved_content" | "web_search";
      session_id: string;
    }
  | { type: "error"; detail: string };
