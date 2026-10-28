// Design Ref: §7·§8 — POST /api/ask 응답 형식. 서버(route.ts)와 화면(PLAN 10번)이 함께 쓴다.

export type Source = {
  id: string;
  source: string;
  item: string;
  excerpt: string;
  baseDate: string;
  url: string;
};

export type AnswerResponse = {
  status: "answered" | "no_evidence";
  answer: string;
  ambiguous: boolean;
  interpretations: string[];
  termMismatch: { a: string; b: string }[];
  sources: Source[];
};

export type ErrorCode =
  | "INVALID_INPUT"
  | "PERSONAL_INFO"
  | "DAILY_LIMIT"
  | "AI_ERROR"
  | "AI_TIMEOUT";

export type ErrorResponse = {
  status: "error";
  code: ErrorCode;
  message: string;
};

export type AskResponse = AnswerResponse | ErrorResponse;
