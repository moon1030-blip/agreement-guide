// Design Ref: §5.2·§7·§13 — 질문을 받는 서버 API.
// 입력 검사 → 올린 자료 검증 → 하루 제한 → 관련 자료 찾기(공개 자료 + 올린 자료) → 찾은 항목만 근거로 AI 해석 답변 → 서버 확인 순서로 처리한다.
import { generateAnswer, noEvidenceResponse } from "@/lib/answer";
import type { ErrorResponse } from "@/lib/askResponse";
import { tryConsumeDailyQuestion } from "@/lib/dailyLimit";
import { toAiErrorResponse } from "@/lib/openai";
import { embedQuestion, findRelatedByVector } from "@/lib/retrieve";
import { findUploadedRelated, parseUploadedDocs } from "@/lib/uploads";
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

  const fields = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};

  // Plan SC: 화면 검사는 우회될 수 있으므로 서버에서 같은 규칙으로 다시 검사한다.
  const validation = validateQuestion(typeof fields.question === "string" ? fields.question : "");
  if (!validation.ok) {
    return errorResponse(400, {
      status: "error",
      code: validation.code,
      message: validation.message,
    });
  }

  // 올린 자료도 화면에서 온 값이라 모양·크기·대외비 표시를 서버에서 다시 확인한다.
  const uploads = parseUploadedDocs(fields.uploaded);
  if (!uploads.ok) {
    return errorResponse(400, { status: "error", code: uploads.code, message: uploads.message });
  }

  // Plan SC: AI 사용 요금을 관리하기 위해 앱 전체 질문을 하루 100건으로 제한한다.
  if (!tryConsumeDailyQuestion()) {
    return errorResponse(429, {
      status: "error",
      code: "DAILY_LIMIT",
      message: "오늘 질문 가능 횟수를 모두 사용했어요. 내일 다시 이용해 주세요.",
    });
  }

  try {
    const questionVector = await embedQuestion(validation.question);
    const related = [
      ...findRelatedByVector(validation.question, questionVector),
      ...findUploadedRelated(questionVector, uploads.docs),
    ];
    // Design §5.2-5: 관련 항목이 없으면 답변 AI를 부르지 않고 "근거 없음"으로 답한다.
    if (related.length === 0) return Response.json(noEvidenceResponse());

    return Response.json(await generateAnswer(validation.question, related));
  } catch (error) {
    const { status, body } = toAiErrorResponse(error);
    return errorResponse(status, body);
  }
}
