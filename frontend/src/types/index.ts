// ============ 后端接口类型契约 ============
// 与 backend/app 的 Pydantic model / dict 返回一一对应

// ---------- Repo ----------
export type RepoStatus = "pending" | "indexing" | "indexed" | "error";

export interface Repo {
  repo_id: string;
  name: string;
  path: string;
  status: RepoStatus;
  created_at: string;
  file_count: number;
  chunk_count: number;
  error_msg: string | null;
  source?: "upload";
}

export interface IndexStatus {
  repo_id: string;
  status: RepoStatus;
  error_msg: string | null;
}

// ---------- Chunk ----------
export interface Chunk {
  chunk_id: string;
  repo_id: string;
  content: string;
  file_path: string;
  line_start: number;
  line_end: number;
  char_count: number;
  chunk_index: number;
  overlap_start: number | null;
  overlap_end: number | null;
}

export interface ChunkContext {
  chunk: Chunk;
  file_content: string;
  file_path: string;
  total_lines: number;
  highlight_start: number;
  highlight_end: number;
}

export interface RepoStats {
  total_chunks: number;
  total_files: number;
  embedding_dim: number;
  chunk_size: number;
  chunk_overlap: number;
  file_distribution: Array<{ file_path: string; chunk_count: number }>;
}

// ---------- Search ----------
export interface SearchHit {
  chunk_id: string;
  content: string;
  file_path: string;
  line_start: number;
  line_end: number;
  score: number;
  distance: number;
}

export interface SearchResponse {
  query_embedding_preview: number[];
  results: SearchHit[];
  total_searched: number;
}

// ---------- Chat ----------
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  rag_data?: {
    retrieval: SearchHit[];
    prompt_parts: PromptParts;
    total_tokens_estimate: number;
  };
}

export interface ChatSession {
  session_id: string;
  repo_id: string | null;
  created_at: string;
  messages: ChatMessage[];
}

export interface PromptParts {
  system: string;
  context: string;
  history: ChatMessage[];
  user_message: string;
}

export interface PromptPreview {
  prompt_parts: PromptParts;
  total_tokens_estimate: number;
  retrieval_results: SearchHit[];
}

// SSE 4 阶段事件类型
export type ChatStreamEvent =
  | { type: "retrieval"; results: SearchHit[] }
  | { type: "prompt"; prompt_parts: PromptParts; total_tokens_estimate: number }
  | { type: "chunk"; content: string }
  | { type: "error"; message: string }
  | { type: "done"; session_id: string };

// ---------- Settings ----------
export interface Settings {
  llm_api_key: string;
  llm_base_url: string;
  llm_model: string;
  embedding_api_key: string;
  embedding_base_url: string;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
  system_prompt: string;
}

// ---------- Health ----------
export interface HealthStatus {
  status: "ok";
  version: string;
}
