// Design Ref: §13.2 (2~4단계) — 올린 PDF에서 글자를 꺼내고 쪽 단위 조각으로 나눈다 (서버 전용).
import "server-only";
import { extractText, getDocumentProxy } from "unpdf";
import { MAX_UPLOAD_PAGES } from "./uploadTypes";

// 조각 하나의 목표 길이. 이 길이를 넘기면 줄이 끝나는 곳에서 자른다.
const TARGET_CHUNK_CHARS = 450;
const MIN_CHUNK_CHARS = 30;

export class PdfUnreadableError extends Error {}
export class PdfTooLongError extends Error {}

// 쪽마다 글자를 꺼낸다. 쪽 수가 한도를 넘거나 암호·손상된 PDF면 오류를 던진다.
export async function extractPdfPages(bytes: Uint8Array): Promise<string[]> {
  let pdf;
  try {
    // 그림 하나가 메모리를 과하게 쓰지 못하게 크기를 제한한다 (약 16MP).
    pdf = await getDocumentProxy(bytes, { maxImageSize: 16_777_216 });
  } catch {
    throw new PdfUnreadableError("PDF를 열 수 없어요 (암호가 걸렸거나 손상된 파일일 수 있어요).");
  }
  if (pdf.numPages > MAX_UPLOAD_PAGES) {
    throw new PdfTooLongError(`쪽 수가 너무 많아요 (${MAX_UPLOAD_PAGES}쪽 이하만 올릴 수 있어요).`);
  }
  try {
    const { text } = await extractText(pdf, { mergePages: false });
    return text;
  } catch {
    throw new PdfUnreadableError("PDF에서 글자를 꺼내지 못했어요.");
  }
}

export type PageChunk = { page: number; text: string };

// 쪽별 글자를 줄 단위로 모아 약 450자 조각으로 나눈다. 조각은 쪽을 넘지 않는다.
export function chunkPages(pages: string[]): PageChunk[] {
  const chunks: PageChunk[] = [];

  pages.forEach((pageText, index) => {
    const page = index + 1;
    const lines = pageText
      .split(/\r?\n/)
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .filter((line) => line.length > 0);

    let buffer = "";
    const flush = () => {
      const text = buffer.trim();
      if (text.length >= MIN_CHUNK_CHARS) chunks.push({ page, text });
      buffer = "";
    };

    for (const line of lines) {
      buffer = buffer ? `${buffer}\n${line}` : line;
      if (buffer.length >= TARGET_CHUNK_CHARS) flush();
    }
    flush();
  });

  return chunks;
}
