// Design Ref: §13.2 — 사용자가 올린 PDF를 받아 글자를 꺼내고, 본문을 검사하고, 조각마다 뜻 지문을 만들어 돌려준다.
// 파일과 조각은 서버에 저장하지 않는다. 돌려준 내용은 올린 사람의 화면(브라우저 메모리)에만 남는다.
// Plan SC: 대외비·개인정보가 걸리면 외부 AI로 보내기 전에 거절한다.
import embeddingsIndex from "@/data/embeddings.json";
import type { ErrorCode } from "@/lib/askResponse";
import { tryConsumeDailyUpload, todayInSeoul } from "@/lib/dailyLimit";
import { getOpenAI, toAiErrorResponse } from "@/lib/openai";
import { PdfTooLongError, PdfUnreadableError, chunkPages, extractPdfPages } from "@/lib/pdf";
import {
  MAX_CHUNKS_PER_FILE,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_TEXT_CHARS,
  UPLOAD_VECTOR_DIMENSIONS,
  type UploadedDoc,
} from "@/lib/uploadTypes";
import { findUploadBlockedReason } from "@/lib/validate";

const EMBED_BATCH_SIZE = 100;
const MIN_TEXT_CHARS = 50;
const MAX_NAME_LENGTH = 80;

function fail(status: number, code: ErrorCode, message: string) {
  return Response.json({ status: "error", code, message }, { status });
}

// 경로나 이상한 글자를 빼고 화면에 보여줄 파일 이름만 남긴다.
function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  return base.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, MAX_NAME_LENGTH);
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "UPLOAD_INVALID", "파일을 읽지 못했어요. 다시 올려 주세요.");
  }

  // Plan SC: 올리는 사람이 공개 자료임을 확인해야만 받는다.
  if (form.get("confirmed") !== "true") {
    return fail(400, "UPLOAD_INVALID", "공개된 자료이며 대외비·개인정보가 없음을 확인해 주세요.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return fail(400, "UPLOAD_INVALID", "PDF 파일을 선택해 주세요.");
  }
  const name = cleanFileName(file.name);
  if (!name.toLowerCase().endsWith(".pdf")) {
    return fail(400, "UPLOAD_INVALID", "PDF 파일(.pdf)만 올릴 수 있어요.");
  }
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    return fail(400, "UPLOAD_INVALID", `파일은 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB 이하여야 해요.`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // 파일 이름만 .pdf로 바꾼 다른 파일을 걸러낸다 (진짜 PDF는 "%PDF-"로 시작한다).
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
  if (!isPdf) {
    return fail(400, "UPLOAD_INVALID", "PDF 형식이 아니에요. 파일 이름만 .pdf인 다른 파일은 올릴 수 없어요.");
  }

  // Plan SC: AI 사용 요금을 관리하기 위해 업로드도 하루 한도를 둔다.
  if (!tryConsumeDailyUpload()) {
    return fail(429, "DAILY_LIMIT", "오늘 업로드 가능 횟수를 모두 사용했어요. 내일 다시 이용해 주세요.");
  }

  let pages: string[];
  try {
    pages = await extractPdfPages(bytes);
  } catch (error) {
    if (error instanceof PdfTooLongError || error instanceof PdfUnreadableError) {
      return fail(400, "UPLOAD_INVALID", error.message);
    }
    return fail(400, "UPLOAD_INVALID", "PDF를 처리하지 못했어요.");
  }

  const fullText = pages.join("\n");
  if (fullText.trim().length < MIN_TEXT_CHARS) {
    return fail(400, "UPLOAD_INVALID", "글자를 읽을 수 없는 PDF예요. 그림만 있는 스캔본은 올릴 수 없어요.");
  }
  if (fullText.length > MAX_UPLOAD_TEXT_CHARS) {
    return fail(400, "UPLOAD_INVALID", "내용이 너무 길어요. 필요한 부분만 나눠서 올려 주세요.");
  }

  // Plan SC: 외부 AI(뜻 지문 생성)로 보내기 전에 본문을 검사한다.
  const blockedReason = findUploadBlockedReason(fullText);
  if (blockedReason) {
    return fail(400, "UPLOAD_BLOCKED", `이 자료는 올릴 수 없어요. ${blockedReason}`);
  }

  const pageChunks = chunkPages(pages);
  if (pageChunks.length === 0) {
    return fail(400, "UPLOAD_INVALID", "글자를 읽을 수 없는 PDF예요.");
  }
  if (pageChunks.length > MAX_CHUNKS_PER_FILE) {
    return fail(400, "UPLOAD_INVALID", "분량이 너무 많아요. 필요한 부분만 나눠서 올려 주세요.");
  }

  try {
    const vectors: number[][] = [];
    for (let i = 0; i < pageChunks.length; i += EMBED_BATCH_SIZE) {
      const batch = pageChunks.slice(i, i + EMBED_BATCH_SIZE);
      const res = await getOpenAI().embeddings.create({
        model: embeddingsIndex.model,
        dimensions: UPLOAD_VECTOR_DIMENSIONS,
        input: batch.map((chunk) => chunk.text),
      });
      // 화면으로 돌려주는 크기를 줄이려고 소수점 4자리까지만 남긴다.
      res.data.forEach((row) => vectors.push(row.embedding.map((v) => Math.round(v * 1e4) / 1e4)));
    }

    const docId = crypto.randomUUID().slice(0, 8);
    const doc: UploadedDoc = {
      docId,
      name,
      uploadedAt: todayInSeoul(),
      chunks: pageChunks.map((chunk, index) => ({
        id: `up-${docId}-${index + 1}`,
        page: chunk.page,
        text: chunk.text,
        vec: vectors[index],
      })),
    };
    return Response.json({ status: "uploaded", doc });
  } catch (error) {
    const { status, body } = toAiErrorResponse(error);
    return Response.json(body, { status });
  }
}
