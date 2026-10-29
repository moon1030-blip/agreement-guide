// Design Ref: §5.2 (3~5단계) — 질문의 뜻 지문을 공개 자료 항목의 뜻 지문과 비교해 관련 항목을 찾는다 (서버 전용).
// Plan SC: Must ② 용어가 달라도 같은 개념의 내용을 함께 찾는다.
import "server-only";
import chunks from "@/data/chunks.json";
import index from "@/data/embeddings.json";
import { getOpenAI } from "./openai";

export type Chunk = (typeof chunks)[number];
export type RelatedChunk = { chunk: Chunk; score: number };

// PRD 5번: 관련 내용은 최대 5개.
export const MAX_RELATED = 5;
// 이 점수보다 낮으면 관련 없는 항목으로 보고 버린다.
// 보정(질문 17개) 결과: 관련 질문의 1위 점수는 0.32 이상, 날씨·점심처럼 전혀 다른 질문은 0.23 이하였다.
// 주택청약처럼 금융 쪽 무관 질문은 0.38까지 나와 이 단계에서 걸러지지 않으므로,
// 최종 "근거 없음" 판단은 답변 단계(PLAN 13·14번)의 AI가 맡는다.
export const MIN_SCORE = 0.25;

const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / Math.sqrt(normA * normB);
}

export async function findRelated(question: string): Promise<RelatedChunk[]> {
  const res = await getOpenAI().embeddings.create({
    model: index.model,
    dimensions: index.dimensions,
    input: question,
  });
  const q = res.data[0].embedding;

  return index.vectors
    .map(({ id, full, title }) => ({
      chunk: chunkById.get(id),
      // 본문 지문과 제목 지문 중 높은 점수를 쓴다.
      score: Math.max(cosine(q, full), cosine(q, title)),
    }))
    .filter((r): r is RelatedChunk => r.chunk !== undefined && r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RELATED);
}
