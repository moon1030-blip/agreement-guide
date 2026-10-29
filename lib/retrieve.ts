// Design Ref: §5.2 (3~5단계) — 질문과 관련된 공개 자료 항목을 찾는다 (서버 전용).
// Plan SC: Must ② 용어가 달라도 같은 개념의 내용을 함께 찾는다.
//
// 두 가지 점수를 함께 쓴다.
//  1. 뜻 점수: 질문의 뜻 지문(임베딩)과 항목의 "제목+본문"·"제목" 지문을 비교한 값 중 큰 값.
//     "깎아→감면", "독촉→추심"처럼 표현이 달라도 찾는다. 상위 4개를 고른다.
//  2. 글자 겹침 점수: 질문과 항목에 함께 들어 있는 두 글자 조각의 드문 정도(IDF) 합계.
//     본문 한 문단에만 있는 단어(예: Q2 본문 속 "수수료")를 뜻 점수가 놓칠 때를 보완한다.
//     기준을 넘는 항목 중 1개를 다섯 번째 자리에 더한다.
// 보정(질문 20개) 결과: 정답 항목이 5위 안에 든 질문 15개 중 14개, 날씨·점심 같은 무관 질문은 차단.
// 금융 쪽 무관 질문(주택청약 등)은 통과하므로, 최종 "근거 없음" 판단은 답변 AI(lib/answer.ts)가 맡는다.
import "server-only";
import chunks from "@/data/chunks.json";
import index from "@/data/embeddings.json";
import { getOpenAI } from "./openai";

export type Chunk = (typeof chunks)[number];
export type RelatedChunk = { chunk: Chunk; score: number };

// PRD 5번: 관련 내용은 최대 5개. 그중 1자리는 글자 겹침으로 찾은 항목에 쓸 수 있다.
export const MAX_RELATED = 5;
const MAX_BY_MEANING_WITH_KEYWORD = MAX_RELATED - 1;
// 뜻 점수가 이보다 낮으면 관련 없는 항목으로 본다 (관련 질문 1위 0.32 이상, 날씨·점심 0.25 미만).
export const MIN_SCORE = 0.25;
// 글자 겹침 점수가 이 이상이어야 다섯 번째 자리에 넣는다 (드문 단어 조각 2개 정도가 겹친 수준).
const MIN_KEYWORD_SCORE = 5;

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

// 한글·영문·숫자만 남겨 두 글자씩 자른다. 예: "수수료가" → 수수, 수료, 료가
function bigrams(text: string): Set<string> {
  const cleaned = text.replace(/[^가-힣a-zA-Z0-9]/g, "");
  const grams = new Set<string>();
  for (let i = 0; i < cleaned.length - 1; i++) grams.add(cleaned.slice(i, i + 2));
  return grams;
}

const chunkGrams = new Map(chunks.map((chunk) => [chunk.id, bigrams(chunk.item + chunk.text)]));
const documentFrequency = new Map<string, number>();
for (const grams of chunkGrams.values()) {
  for (const gram of grams) documentFrequency.set(gram, (documentFrequency.get(gram) ?? 0) + 1);
}

// 여러 항목에 흔하게 나오는 조각일수록 0에 가깝고, 한두 항목에만 나오는 조각일수록 크다.
function rarity(gram: string): number {
  return Math.log(chunks.length / (documentFrequency.get(gram) ?? chunks.length));
}

function keywordScore(questionGrams: Set<string>, chunkId: string): number {
  const grams = chunkGrams.get(chunkId);
  if (!grams) return 0;
  let score = 0;
  for (const gram of questionGrams) if (grams.has(gram)) score += rarity(gram);
  return score;
}

export async function findRelated(question: string): Promise<RelatedChunk[]> {
  const res = await getOpenAI().embeddings.create({
    model: index.model,
    dimensions: index.dimensions,
    input: question,
  });
  const q = res.data[0].embedding;
  const questionGrams = bigrams(question);

  const byMeaning = index.vectors
    .map(({ id, full, title }) => ({
      chunk: chunkById.get(id),
      score: Math.max(cosine(q, full), cosine(q, title)),
    }))
    .filter((r): r is RelatedChunk => r.chunk !== undefined && r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  const topByMeaning = byMeaning.slice(0, MAX_BY_MEANING_WITH_KEYWORD);
  const taken = new Set(topByMeaning.map((r) => r.chunk.id));
  const byKeyword = chunks
    .filter((chunk) => !taken.has(chunk.id))
    .map((chunk) => ({ chunk, score: keywordScore(questionGrams, chunk.id) }))
    .filter((r) => r.score >= MIN_KEYWORD_SCORE)
    .sort((a, b) => b.score - a.score)[0];

  return byKeyword ? [...topByMeaning, byKeyword] : byMeaning.slice(0, MAX_RELATED);
}
