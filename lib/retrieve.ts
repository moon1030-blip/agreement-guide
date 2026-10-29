// Design Ref: §5.2 (3~5단계) — 질문과 관련된 공개 자료 항목을 찾는다 (서버 전용).
// Plan SC: Must ② 용어가 달라도 같은 개념의 내용을 함께 찾는다.
//
// 두 가지 점수를 함께 쓴다.
//  1. 뜻 점수: 질문의 뜻 지문(임베딩)과 항목의 "제목+본문"·"제목" 지문을 비교한 값 중 큰 값.
//     "깎아→감면", "독촉→추심"처럼 표현이 달라도 찾는다. 상위 4개를 고른다.
//  2. 글자 겹침 점수: 질문과 항목에 함께 들어 있는 두 글자 조각의 드문 정도(IDF) 합계.
//     본문 한 문단에만 있는 단어(예: Q2 본문 속 "수수료")를 뜻 점수가 놓칠 때를 보완한다.
//     기준을 넘는 항목 중 1개를 마지막 자리에 더한다.
// 보정(질문 20개) 결과: 정답 항목이 후보 5개 안에 든 질문 15개 중 14개, 날씨·점심 같은 무관 질문은 차단.
// 금융 쪽 무관 질문(주택청약 등)은 통과하므로, 최종 "근거 없음" 판단은 답변 AI(lib/answer.ts)가 맡는다.
import "server-only";
import chunks from "@/data/chunks.json";
import index from "@/data/embeddings.json";
import { getOpenAI } from "./openai";

// 미리 넣어 둔 공개 자료와 사용자가 올린 자료의 조각을 같은 모양으로 다룬다.
export type Chunk = {
  id: string;
  source: string;
  item: string;
  text: string;
  baseDate: string;
  // 공식 자료의 원문 주소. 사용자가 올린 자료는 주소가 없다.
  url: string | null;
  origin: "public" | "uploaded";
};
export type RelatedChunk = { chunk: Chunk; score: number };

const publicChunks: Chunk[] = chunks.map((chunk) => ({ ...chunk, origin: "public" as const }));

// 답변 AI에게 넘기는 후보는 10개까지 넓게 잡는다. 그중 1자리는 글자 겹침으로 찾은 항목이다.
// 화면에 보이는 근거는 AI가 실제로 쓴 항목 중 최대 5개로 줄인다 (PRD 5번, lib/answer.ts).
// 후보를 5개로 좁히면, 여러 이야기가 한 항목에 섞여 뜻 점수가 희석된 항목(예: Q5의 "무담보 10년")이
// 6~7위로 밀려 AI가 아예 보지 못해 틀린 답이 나왔다 (점검 5번, data/eval/report.md).
export const MAX_CANDIDATES = 10;
// 글자 겹침으로 찾은 항목에 주는 자리 수. 뜻 점수가 거의 평평한 짧은 질문(예: 신청기한)에서는 정답이 글자 겹침으로만 잡히므로 2자리를 둔다.
const KEYWORD_SLOTS = 2;
const MAX_BY_MEANING_WITH_KEYWORD = MAX_CANDIDATES - KEYWORD_SLOTS;
// 뜻 점수가 이보다 낮으면 관련 없는 항목으로 본다 (관련 질문 1위 0.32 이상, 날씨·점심 0.25 미만).
export const MIN_SCORE = 0.25;
// 글자 겹침 점수가 이 이상이어야 다섯 번째 자리에 넣는다 (드문 단어 조각 2개 정도가 겹친 수준).
const MIN_KEYWORD_SCORE = 5;

const chunkById = new Map(publicChunks.map((chunk) => [chunk.id, chunk]));

export function cosine(a: number[], b: number[]): number {
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

const fullVectorById = new Map(index.vectors.map((entry) => [entry.id, entry.full]));

// 공개 자료 두 항목의 내용이 얼마나 비슷한지(뜻 지문 비교). 지문이 없는 항목(올린 자료)이면 null.
export function chunkSimilarity(idA: string, idB: string): number | null {
  const a = fullVectorById.get(idA);
  const b = fullVectorById.get(idB);
  return a && b ? cosine(a, b) : null;
}

// 자료에서 같은 뜻으로 쓰이는데 글자가 다른 말을 질문 뒤에 덧붙여 찾는다 (뜻 점수와 글자 겹침 점수 모두).
// 예: 질문은 "신청기한"인데 보도자료는 "신청기간 … 까지 신청 가능"이라고 써서 정답 항목을 못 찾았다.
// 질문 원문은 그대로 두고 찾기용으로만 쓰며, 답변 AI에게는 원문 질문을 넘긴다.
const SYNONYM_GROUPS: string[][] = [
  ["기한", "기간", "마감", "언제까지"],
];

export function expandQuestion(question: string): string {
  const extra = new Set<string>();
  for (const group of SYNONYM_GROUPS) {
    if (!group.some((word) => question.includes(word))) continue;
    for (const word of group) if (!question.includes(word)) extra.add(word);
  }
  return extra.size > 0 ? `${question} (${[...extra].join(" ")})` : question;
}

// 질문의 뜻 지문을 만든다. 공개 자료 찾기와 올린 자료 찾기가 이 값을 함께 쓴다.
export async function embedQuestion(question: string): Promise<number[]> {
  const res = await getOpenAI().embeddings.create({
    model: index.model,
    dimensions: index.dimensions,
    input: expandQuestion(question),
  });
  return res.data[0].embedding;
}

export function findRelatedByVector(question: string, q: number[]): RelatedChunk[] {
  const questionGrams = bigrams(expandQuestion(question));

  const byMeaning = index.vectors
    .map(({ id, full, title, lead }) => ({
      chunk: chunkById.get(id),
      score: Math.max(cosine(q, full), cosine(q, title), cosine(q, lead)),
    }))
    .filter((r): r is RelatedChunk => r.chunk !== undefined && r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  const topByMeaning = byMeaning.slice(0, MAX_BY_MEANING_WITH_KEYWORD);
  const taken = new Set(topByMeaning.map((r) => r.chunk.id));
  const byKeyword = publicChunks
    .filter((chunk) => !taken.has(chunk.id))
    .map((chunk) => ({ chunk, score: keywordScore(questionGrams, chunk.id) }))
    .filter((r) => r.score >= MIN_KEYWORD_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, KEYWORD_SLOTS);

  const base =
    byKeyword.length > 0
      ? [...topByMeaning, ...byKeyword, ...byMeaning.slice(MAX_BY_MEANING_WITH_KEYWORD).slice(0, KEYWORD_SLOTS - byKeyword.length)]
      : byMeaning.slice(0, MAX_CANDIDATES);
  return [...base, ...newerSiblings(base)];
}

// 같은 주제를 다룬 더 최근 자료를 후보에 더한다. 질문과 말이 가장 잘 맞는 자료가 오래된 보도자료여도(예: 2025-03 "지원 대상 확대"),
// 이후 보도자료가 같은 내용을 다시 바꿨다면(2025-09 "더 확대") AI가 그것을 볼 수 있어야 최신 기준으로 답할 수 있다.
// (보도자료 15건을 더한 뒤 점검에서 확인한 문제. 점수: 두 항목의 뜻 지문 비교)
const NEWER_SIBLING_MIN_SIMILARITY = 0.74;
const MAX_NEWER_SIBLINGS = 4;
const SIBLING_BASE_COUNT = 5;

function newerSiblings(base: RelatedChunk[]): RelatedChunk[] {
  const taken = new Set(base.map((r) => r.chunk.id));
  const found = new Map<string, RelatedChunk>();
  for (const { chunk } of base.slice(0, SIBLING_BASE_COUNT)) {
    if (chunk.origin !== "public") continue;
    for (const other of publicChunks) {
      if (taken.has(other.id) || other.baseDate <= chunk.baseDate) continue;
      const score = chunkSimilarity(chunk.id, other.id) ?? 0;
      if (score < NEWER_SIBLING_MIN_SIMILARITY) continue;
      const best = found.get(other.id);
      if (!best || score > best.score) found.set(other.id, { chunk: other, score });
    }
  }
  return [...found.values()].sort((a, b) => b.score - a.score).slice(0, MAX_NEWER_SIBLINGS);
}
