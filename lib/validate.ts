// Design Ref: §4·§8 — 입력 검사. 화면(AskForm)과 서버(PLAN 9번)가 같은 규칙을 쓴다.
// Plan SC: 대외비 협약 문구와 개인정보가 외부 AI로 전송되지 않게 한다.

export const MAX_QUESTION_LENGTH = 200;

// 검사용 글자 정리 (원문은 바꾸지 않고, 검사할 때만 쓴다).
// - NFKC: 전각 숫자(９００１０１)·전각 대시(－)를 반각으로 바꿔 우회를 막는다.
// - 여러 대시 모양(‐ ‑ ‒ – — ― −)을 하이픈 하나로 통일한다.
// - 연속 공백·줄바꿈을 공백 하나로 줄인다. 정규식이 공백 덩어리에서 오래 헤매지(ReDoS) 않게 하는 이유도 있다.
function normalizeForCheck(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‐-―−﹘﹣]/g, "-")
    .replace(/\s+/g, " ");
}

// 숫자 사이의 공백·점·하이픈을 모두 지운 사본 (예: "900 101-1234567", "110 234 567890")
function squashDigits(text: string): string {
  return text.replace(/(?<=\d)[ .-]+(?=\d)/g, "");
}

// 주민등록번호·외국인등록번호: 6자리 + 구분 최대 2자 + 7자리, 뒷자리 첫 숫자 1~8. 구분자 길이에 상한을 둬서 느려지지 않는다.
const RESIDENT_NUMBER = /\d{6}[ .-]{0,2}[1-8]\d{6}/;
// 숫자를 모두 이은 사본에서: 13자리 주민번호 모양, 또는 10자리 이상 연속 숫자(계좌·전화)
const SQUASHED_RESIDENT_NUMBER = /(?<!\d)\d{6}[1-8]\d{6}(?!\d)/;
const LONG_DIGITS = /\d{10,}/;
// 하이픈으로 이어진 계좌번호 모양. 날짜(2025-09-18)는 먼저 지운 뒤 본다.
const ACCOUNT_NUMBER = /\d{2,6}-\d{2,6}-\d{2,8}/;
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;
// 협약 원문 붙여넣기 의심: "제3조", "제 12 조", "제○조", "제一조", "별첨"
const AGREEMENT_REFERENCE = /제\s?[\d○一二三四五六七八九十百]+\s?조|별첨/;

export type ValidationResult =
  | { ok: true; question: string }
  | { ok: false; code: "INVALID_INPUT" | "PERSONAL_INFO"; message: string };

// 개인정보로 보이는 숫자가 있는가 (질문용, 우회를 넓게 막는다)
function looksLikePersonalNumber(text: string): boolean {
  const normalized = normalizeForCheck(text);
  if (RESIDENT_NUMBER.test(normalized)) return true;
  const squashed = squashDigits(normalized);
  if (SQUASHED_RESIDENT_NUMBER.test(squashed) || LONG_DIGITS.test(squashed)) return true;
  return ACCOUNT_NUMBER.test(normalized.replace(ISO_DATE, " "));
}

export function validateQuestion(raw: string): ValidationResult {
  const question = raw.trim();

  if (question.length === 0 || question.length > MAX_QUESTION_LENGTH) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: `질문은 1~${MAX_QUESTION_LENGTH}자로 입력하세요.`,
    };
  }

  if (looksLikePersonalNumber(question)) {
    return {
      ok: false,
      code: "PERSONAL_INFO",
      message: "개인정보로 보이는 숫자가 있어요. 해당 부분을 지운 뒤 다시 보내세요.",
    };
  }

  return { ok: true, question };
}

export function mentionsAgreementText(question: string): boolean {
  return AGREEMENT_REFERENCE.test(normalizeForCheck(question));
}

// --- 사용자가 올린 PDF 본문 검사 (Design §13.2) ---
// 공개 문서에도 날짜(2025-09-18)·전화번호가 흔하므로, 질문 검사보다 좁게 본다.

// 대외비·내부 문서 표시. 한국어 PDF는 글자를 꺼낼 때 글자 사이에 공백이 끼는 일이 흔해서(대 외 비), 공백을 모두 지운 사본으로도 본다.
const CONFIDENTIAL_MARKER = /대외비|내부용|내부자료|사외비|對外秘|Confidential|InternalUse/i;
// "제3조", "제 12 조", "제一조" (협약·계약 문서는 조항 번호가 계속 나온다)
const ARTICLE_REFERENCE = /제 ?[\d一二三四五六七八九十百]+ ?조/g;
const MAX_ARTICLE_REFERENCES = 3;
// 계좌번호는 "계좌"라는 말 바로 뒤의 긴 숫자만 본다
const ACCOUNT_AFTER_LABEL = /계좌[^\d\n]{0,12}\d[\d-]{7,}/;

// 올릴 수 없는 이유를 한 줄로 돌려준다. 문제가 없으면 null.
export function findUploadBlockedReason(text: string): string | null {
  const normalized = normalizeForCheck(text);
  if (CONFIDENTIAL_MARKER.test(normalized) || CONFIDENTIAL_MARKER.test(normalized.replace(/ /g, ""))) {
    return "'대외비'·'내부용' 같은 표시가 들어 있어요.";
  }
  if ((normalized.match(ARTICLE_REFERENCE) ?? []).length >= MAX_ARTICLE_REFERENCES) {
    return "'제○조'가 여러 번 나와 협약·계약 문서로 보여요.";
  }
  if (RESIDENT_NUMBER.test(normalized) || ACCOUNT_AFTER_LABEL.test(normalized)) {
    return "주민등록번호나 계좌번호로 보이는 숫자가 들어 있어요.";
  }
  return null;
}
