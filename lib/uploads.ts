// Design Ref: §13.2 (질문 단계) — 화면이 질문과 함께 보낸 "올린 자료"를 검증하고, 질문과 가까운 조각을 고른다 (서버 전용).
// 화면에서 온 값은 믿지 않고 모양·크기·본문 검사를 서버에서 다시 한다.
import "server-only";
import { cosine, type RelatedChunk } from "./retrieve";
import {
  MAX_CHUNK_CHARS,
  MAX_CHUNKS_PER_FILE,
  MAX_UPLOAD_CHUNKS_TOTAL,
  MAX_UPLOAD_FILES,
  UPLOAD_VECTOR_DIMENSIONS,
  type UploadedDoc,
} from "./uploadTypes";
import { findUploadBlockedReason } from "./validate";

// 올린 자료에서 답변 AI에게 넘기는 조각은 최대 4개다.
export const MAX_UPLOADED_CANDIDATES = 4;
// 이 점수보다 낮으면 관련 없는 조각으로 본다 (256차원 지문 기준, 보정 결과는 lib/uploads.ts 아래 주석 참고).
export const MIN_UPLOAD_SCORE = 0.3;

const MAX_NAME_LENGTH = 80;
const MAX_ID_LENGTH = 64;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ParsedUploads =
  | { ok: true; docs: UploadedDoc[] }
  | { ok: false; code: "UPLOAD_INVALID" | "UPLOAD_BLOCKED"; message: string };

const invalid = (message: string): ParsedUploads => ({ ok: false, code: "UPLOAD_INVALID", message });

const CONTROL_OR_BRACKET = new RegExp("[\\u0000-\\u001f\\u007f<>\\[\\]]", "g");

function cleanDisplayName(name: string): string {
  return name.replace(CONTROL_OR_BRACKET, " ").replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}

// 공백뿐이거나 너무 짧은 조각은 받지 않는다 (검사를 느리게 만드는 입력 방지).
const MIN_CHUNK_TEXT = 30;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseUploadedDocs(raw: unknown): ParsedUploads {
  if (raw === undefined || raw === null) return { ok: true, docs: [] };
  if (!Array.isArray(raw)) return invalid("올린 자료의 형식이 올바르지 않아요.");
  if (raw.length > MAX_UPLOAD_FILES) return invalid(`올린 자료는 ${MAX_UPLOAD_FILES}개까지만 쓸 수 있어요.`);

  const docs: UploadedDoc[] = [];
  let totalChunks = 0;

  for (const rawDoc of raw) {
    if (!isRecord(rawDoc) || !Array.isArray(rawDoc.chunks)) return invalid("올린 자료의 형식이 올바르지 않아요.");
    // 조각을 하나씩 검사하기 전에 개수부터 본다 (터무니없이 많은 조각으로 시간을 쓰게 하지 못하게).
    if (rawDoc.chunks.length > MAX_CHUNKS_PER_FILE) return invalid("올린 자료의 분량이 너무 많아요. 일부를 지워 주세요.");
    const { docId, name: rawName, uploadedAt } = rawDoc;
    // 화면을 우회해 보낸 파일 이름의 줄바꿈·꺾쇠·대괄호는 답변 AI에게 가는 글에 섞이므로 지운다.
    const name = typeof rawName === "string" ? cleanDisplayName(rawName) : rawName;
    if (
      typeof docId !== "string" || docId.length === 0 || docId.length > MAX_ID_LENGTH ||
      typeof name !== "string" || name.length === 0 || name.length > MAX_NAME_LENGTH ||
      typeof uploadedAt !== "string" || !DATE_PATTERN.test(uploadedAt)
    ) {
      return invalid("올린 자료의 형식이 올바르지 않아요.");
    }

    const chunks: UploadedDoc["chunks"] = [];
    for (const rawChunk of rawDoc.chunks) {
      if (!isRecord(rawChunk)) return invalid("올린 자료의 형식이 올바르지 않아요.");
      const { id, page, text, vec } = rawChunk;
      if (
        typeof id !== "string" || id.length === 0 || id.length > MAX_ID_LENGTH ||
        typeof page !== "number" || !Number.isInteger(page) || page < 1 || page > 100_000 ||
        typeof text !== "string" || text.trim().length < MIN_CHUNK_TEXT || text.length > MAX_CHUNK_CHARS ||
        !Array.isArray(vec) || vec.length !== UPLOAD_VECTOR_DIMENSIONS ||
        !vec.every((v) => typeof v === "number" && Number.isFinite(v))
      ) {
        return invalid("올린 자료의 형식이 올바르지 않아요.");
      }
      chunks.push({ id, page, text, vec });
    }

    totalChunks += chunks.length;
    if (totalChunks > MAX_UPLOAD_CHUNKS_TOTAL) return invalid("올린 자료의 분량이 너무 많아요. 일부를 지워 주세요.");
    docs.push({ docId, name, uploadedAt, chunks });
  }

  // 화면을 우회해 직접 호출해도 대외비 표시 등이 있는 내용은 외부 AI로 보내지 않는다.
  const blockedReason = findUploadBlockedReason(docs.flatMap((doc) => doc.chunks.map((chunk) => chunk.text)).join("\n"));
  if (blockedReason) {
    return { ok: false, code: "UPLOAD_BLOCKED", message: `올린 자료를 쓸 수 없어요. ${blockedReason}` };
  }

  return { ok: true, docs };
}

// 질문의 뜻 지문(앞 256개만)과 올린 조각을 비교해 관련 조각을 고른다.
export function findUploadedRelated(questionVector: number[], docs: UploadedDoc[]): RelatedChunk[] {
  if (docs.length === 0) return [];
  const q = questionVector.slice(0, UPLOAD_VECTOR_DIMENSIONS);

  return docs
    .flatMap((doc) =>
      doc.chunks.map((chunk) => ({
        chunk: {
          id: chunk.id,
          source: `내가 올린 자료 · ${doc.name}`,
          item: `${chunk.page}쪽`,
          text: chunk.text,
          baseDate: doc.uploadedAt,
          url: null,
          origin: "uploaded" as const,
        },
        score: cosine(q, chunk.vec),
      })),
    )
    .filter((r) => r.score >= MIN_UPLOAD_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_UPLOADED_CANDIDATES);
}
