// Design Ref: §5.2·§7 — 질문을 받는 서버 API. 관련 공개 자료를 찾아 근거로 돌려준다.
// 답변 문장은 아직 고정 문구이며, AI 답변 생성(PLAN 13·14번)은 이후에 붙인다.
import type { AnswerResponse, ErrorResponse, Source } from "@/lib/askResponse";
import { tryConsumeDailyQuestion } from "@/lib/dailyLimit";
import { toAiErrorResponse } from "@/lib/openai";
import { findRelated, type RelatedChunk } from "@/lib/retrieve";
import { validateQuestion } from "@/lib/validate";

// PRD 5번: 원문 발췌는 200자 이내.
const EXCERPT_LENGTH = 200;

const NO_EVIDENCE_ANSWER =
  "공개 자료에서 근거를 찾을 수 없습니다. 운영처 또는 사내 변호사에게 문의하세요.";

function errorResponse(status: number, body: ErrorResponse) {
  return Response.json(body, { status });
}

function toSource({ chunk }: RelatedChunk): Source {
  const excerpt =
    chunk.text.length > EXCERPT_LENGTH ? `${chunk.text.slice(0, EXCERPT_LENGTH - 1)}…` : chunk.text;
  return {
    id: chunk.id,
    source: chunk.source,
    item: chunk.item,
    excerpt,
    baseDate: chunk.baseDate,
    url: chunk.url,
  };
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

  // Plan SC: AI 사용 요금을 관리하기 위해 앱 전체 질문을 하루 100건으로 제한한다.
  if (!tryConsumeDailyQuestion()) {
    return errorResponse(429, {
      status: "error",
      code: "DAILY_LIMIT",
      message: "오늘 질문 가능 횟수를 모두 사용했어요. 내일 다시 이용해 주세요.",
    });
  }

  let related: RelatedChunk[];
  try {
    related = await findRelated(validation.question);
  } catch (error) {
    const { status, body } = toAiErrorResponse(error);
    return errorResponse(status, body);
  }

  // Design §5.2-5: 관련 항목이 없으면 답변 AI를 부르지 않고 "근거 없음"으로 답한다.
  if (related.length === 0) {
    const response: AnswerResponse = {
      status: "no_evidence",
      answer: NO_EVIDENCE_ANSWER,
      ambiguous: false,
      interpretations: [],
      termMismatch: [],
      sources: [],
    };
    return Response.json(response);
  }

  const response: AnswerResponse = {
    status: "answered",
    answer: "관련 공개 자료를 찾았습니다. 해석 답변 기능은 준비 중입니다.",
    ambiguous: false,
    interpretations: [],
    termMismatch: [],
    sources: related.map(toSource),
  };
  return Response.json(response);
}
