// Design Ref: §3·§9 — OpenAI 연결 (서버 전용). 화면 코드("use client")에서 가져오면 빌드가 실패한다.
// Plan SC: API 키는 서버 코드에서만 사용하고, 이름에 NEXT_PUBLIC_을 붙이지 않는다.
import "server-only";
import OpenAI from "openai";
import type { ErrorResponse } from "./askResponse";

// 화면은 30초에 요청을 멈추므로(DESIGN §8), 서버는 그보다 먼저 포기하고 오류를 알려준다.
const REQUEST_TIMEOUT_MS = 25_000;

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다. .env를 확인하세요.");
  }

  client = new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
  return client;
}

// OpenAI 호출 실패를 화면에 보여줄 오류 응답(DESIGN §8)으로 바꾼다.
export function toAiErrorResponse(error: unknown): { status: number; body: ErrorResponse } {
  const message = "지금은 답변할 수 없습니다. 잠시 후 다시 시도하세요.";
  // 질문 내용은 남기지 않고, 오류 종류만 서버 기록에 남긴다.
  console.error("[ask] OpenAI 호출 실패:", error instanceof Error ? error.name : "unknown");

  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return { status: 504, body: { status: "error", code: "AI_TIMEOUT", message } };
  }
  return { status: 502, body: { status: "error", code: "AI_ERROR", message } };
}
