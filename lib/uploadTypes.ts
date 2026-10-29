// Design Ref: §13 — 사용자가 올린 PDF의 모양과 한도. 화면과 서버가 함께 쓴다 (서버 전용 코드는 넣지 않는다).

export const MAX_UPLOAD_FILES = 3;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel 요청 크기 한도(4.5MB) 안
export const MAX_UPLOAD_PAGES = 60;
export const MAX_UPLOAD_TEXT_CHARS = 100_000;
export const MAX_CHUNKS_PER_FILE = 100;
export const MAX_UPLOAD_CHUNKS_TOTAL = 120;
export const MAX_CHUNK_CHARS = 1_200;
// 질문마다 올린 조각을 서버로 다시 보내야 해서 뜻 지문을 줄여 쓴다 (질문 지문은 앞 256개만 쓴다).
export const UPLOAD_VECTOR_DIMENSIONS = 256;

export type UploadedChunk = {
  id: string;
  page: number;
  text: string;
  vec: number[];
};

export type UploadedDoc = {
  docId: string;
  name: string;
  uploadedAt: string;
  chunks: UploadedChunk[];
};
