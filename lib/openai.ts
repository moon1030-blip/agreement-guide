// Design Ref: §3·§9 — OpenAI 연결 (서버 전용). 화면 코드("use client")에서 가져오면 빌드가 실패한다.
// Plan SC: API 키는 서버 코드에서만 사용하고, 이름에 NEXT_PUBLIC_을 붙이지 않는다.
import "server-only";
import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다. .env를 확인하세요.");
  }

  client = new OpenAI({ apiKey });
  return client;
}
