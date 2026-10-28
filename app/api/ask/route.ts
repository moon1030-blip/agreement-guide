// Design Ref: §5.2·§7 — 질문을 받는 서버 API. 지금은 고정 답변만 돌려준다.
// 하루 제한(PLAN 17번), 관련 내용 찾기·AI 답변(PLAN 11~14번)은 이후에 붙인다.
import type { AnswerResponse, ErrorResponse } from "@/lib/askResponse";
import { validateQuestion } from "@/lib/validate";

function errorResponse(status: number, body: ErrorResponse) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const raw =
    typeof body === "object" && body !== null && "question" in body
      ? (body as { question: unknown }).question
      : undefined;

  // Plan SC: 화면 검사는 우회될 수 있으므로 서버에서 같은 규칙으로 다시 검사한다.
  const validation = validateQuestion(typeof raw === "string" ? raw : "");
  if (!validation.ok) {
    return errorResponse(400, {
      status: "error",
      code: validation.code,
      message: validation.message,
    });
  }

  const response: AnswerResponse = {
    status: "answered",
    answer: "서버 연결 확인용 고정 답변입니다. 실제 답변 기능은 준비 중입니다.",
    ambiguous: false,
    interpretations: [],
    termMismatch: [],
    sources: [],
  };
  return Response.json(response);
}
