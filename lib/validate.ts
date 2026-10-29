// Design Ref: §4·§8 — 입력 검사. 화면(AskForm)과 서버(PLAN 9번)가 같은 규칙을 쓴다.
// Plan SC: 대외비 협약 문구와 개인정보가 외부 AI로 전송되지 않게 한다.

export const MAX_QUESTION_LENGTH = 200;

// 주민등록번호: 6자리-7자리 (하이픈 생략 포함), 뒷자리 첫 숫자 1~4
const RESIDENT_NUMBER = /\d{6}\s*-?\s*[1-4]\d{6}/;
// 계좌번호: 하이픈으로 이어진 숫자 묶음, 또는 10자리 이상 연속 숫자
const ACCOUNT_NUMBER = /\d{2,6}-\d{2,6}-\d{2,8}|\d{10,}/;
// 협약 원문 붙여넣기 의심: "제3조", "제 12 조", "제○조", "별첨"
const AGREEMENT_REFERENCE = /제\s*[\d○]+\s*조|별첨/;

export type ValidationResult =
  | { ok: true; question: string }
  | { ok: false; code: "INVALID_INPUT" | "PERSONAL_INFO"; message: string };

export function validateQuestion(raw: string): ValidationResult {
  const question = raw.trim();

  if (question.length === 0 || question.length > MAX_QUESTION_LENGTH) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: `질문은 1~${MAX_QUESTION_LENGTH}자로 입력하세요.`,
    };
  }

  if (RESIDENT_NUMBER.test(question) || ACCOUNT_NUMBER.test(question)) {
    return {
      ok: false,
      code: "PERSONAL_INFO",
      message: "개인정보로 보이는 숫자가 있어요. 해당 부분을 지운 뒤 다시 보내세요.",
    };
  }

  return { ok: true, question };
}

export function mentionsAgreementText(question: string): boolean {
  return AGREEMENT_REFERENCE.test(question);
}

// --- 사용자가 올린 PDF 본문 검사 (Design §13.2) ---
// 공개 문서에도 날짜(2025-09-18)·전화번호가 흔하므로, 질문 검사보다 좁게 본다.

// 대외비·내부 문서 표시
const CONFIDENTIAL_MARKER = /대외비|내부\s*용|내부\s*자료|사외\s*비|Confidential|Internal\s+Use/i;
// "제3조", "제 12 조" (협약·계약 문서는 조항 번호가 계속 나온다)
const ARTICLE_REFERENCE = /제\s*\d+\s*조/g;
const MAX_ARTICLE_REFERENCES = 3;
// 계좌번호는 "계좌"라는 말 바로 뒤의 긴 숫자만 본다
const ACCOUNT_AFTER_LABEL = /계좌[^\d\n]{0,12}\d[\d-]{7,}/;

// 올릴 수 없는 이유를 한 줄로 돌려준다. 문제가 없으면 null.
export function findUploadBlockedReason(text: string): string | null {
  if (CONFIDENTIAL_MARKER.test(text)) {
    return "'대외비'·'내부용' 같은 표시가 들어 있어요.";
  }
  if ((text.match(ARTICLE_REFERENCE) ?? []).length >= MAX_ARTICLE_REFERENCES) {
    return "'제○조'가 여러 번 나와 협약·계약 문서로 보여요.";
  }
  if (RESIDENT_NUMBER.test(text) || ACCOUNT_AFTER_LABEL.test(text)) {
    return "주민등록번호나 계좌번호로 보이는 숫자가 들어 있어요.";
  }
  return null;
}
