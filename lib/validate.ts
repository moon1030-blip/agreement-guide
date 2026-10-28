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
