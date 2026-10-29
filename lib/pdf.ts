// Design Ref: §13.2 (2~4단계) — 올린 PDF에서 글자를 꺼내고 쪽 단위 조각으로 나눈다 (서버 전용).
import "server-only";
import { getDocumentProxy } from "unpdf";
import { MAX_UPLOAD_PAGES, MAX_UPLOAD_TEXT_CHARS } from "./uploadTypes";

// 글자 꺼내기에 쓸 수 있는 시간 (함수 전체 제한 maxDuration 30초 안에서 나머지 처리 시간을 남긴다).
const EXTRACT_TIME_LIMIT_MS = 15_000;

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
  // 압축된 PDF는 풀면 수백 배로 커질 수 있다. 한 쪽씩 꺼내면서 글자 수와 시간을 확인해, 한도를 넘으면 바로 멈춘다.
  const deadline = Date.now() + EXTRACT_TIME_LIMIT_MS;
  const pages: string[] = [];
  let total = 0;
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      if (Date.now() > deadline) throw new PdfTooLongError("PDF를 읽는 데 너무 오래 걸려요. 필요한 부분만 나눠서 올려 주세요.");
      const content = await (await pdf.getPage(pageNumber)).getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str + (item.hasEOL ? "\n" : " ");
        if (total + text.length > MAX_UPLOAD_TEXT_CHARS) {
          throw new PdfTooLongError("내용이 너무 길어요. 필요한 부분만 나눠서 올려 주세요.");
        }
      }
      total += text.length;
      pages.push(text);
    }
    return pages;
  } catch (error) {
    if (error instanceof PdfTooLongError) throw error;
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
