// Design Ref: §7·§8·§13·§14 — POST /api/ask 응답 형식. 서버(route.ts)와 화면이 함께 쓴다.

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

// 결론 표시: 가능·해당 / 불가·비해당 / 조건에 따라 다름 / 사실·방법·기간·금액 등을 알려 주는 안내
export type Verdict = "possible" | "impossible" | "conditional" | "info";

// 답변 한 문장과, 그 문장의 근거가 된 근거 목록 번호(1부터, `sources` 순서). 번호가 없으면 근거를 특정하지 못한 문장이다.
export type AnswerPoint = {
  text: string;
  cites: number[];
};

export type AnswerResponse = {
  // answered: 근거와 함께 답함 / no_evidence: 새출발기금 질문이지만 공개 자료에 근거가 없음 / out_of_scope: 새출발기금과 관련 없는 질문이라 답변 불가
  status: "answered" | "no_evidence" | "out_of_scope";
  // 아래 구조화 필드를 이어 붙인 일반 글. 화면이 구조를 못 그릴 때와 점검 도구가 쓴다. 500자 이내.
  answer: string;
  verdict: Verdict;
  // 질문에 대한 직접적인 결론 한 문장
  headline: string;
  // 결론을 뒷받침하는 설명 (문장마다 근거 번호)
  reasons: AnswerPoint[];
  // 예외·조건·주의 (문장마다 근거 번호)
  cautions: AnswerPoint[];
  // 해석이 갈리거나 근거가 일부뿐이라 운영처·사내 변호사 확인이 필요한가
  needsInquiry: boolean;
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
