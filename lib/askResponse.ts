// Design Ref: §7·§8·§13 — POST /api/ask 응답 형식. 서버(route.ts)와 화면이 함께 쓴다.

export type Source = {
  id: string;
  source: string;
  item: string;
  excerpt: string;
  baseDate: string;
  // 공식 자료의 원문 주소. 사용자가 올린 자료는 주소가 없다.
  url: string | null;
  // public: 미리 넣어 둔 공개 자료, uploaded: 사용자가 올린 자료
  origin: "public" | "uploaded";
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
  | "UPLOAD_INVALID"
  | "UPLOAD_BLOCKED"
  | "DAILY_LIMIT"
  | "AI_ERROR"
  | "AI_TIMEOUT";

export type ErrorResponse = {
  status: "error";
  code: ErrorCode;
  message: string;
};

export type AskResponse = AnswerResponse | ErrorResponse;
