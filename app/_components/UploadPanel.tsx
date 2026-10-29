"use client";

// Design Ref: §13 — 내 자료 추가(PDF). 올린 자료는 이 화면의 메모리에만 두고 서버에는 저장하지 않는다.
// Plan SC: "공개 자료임을 확인" 체크가 있어야 올릴 수 있고, 대외비 표시 등은 서버가 거절한다.
import { useRef, useState } from "react";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_CHUNKS_TOTAL,
  MAX_UPLOAD_FILES,
  type UploadedDoc,
} from "@/lib/uploadTypes";

type UploadPanelProps = {
  docs: UploadedDoc[];
  onAdd: (doc: UploadedDoc) => void;
  onRemove: (docId: string) => void;
};

export default function UploadPanel({ docs, onAdd, onRemove }: UploadPanelProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const totalChunks = docs.reduce((sum, doc) => sum + doc.chunks.length, 0);
  const full = docs.length >= MAX_UPLOAD_FILES;

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("PDF 파일(.pdf)만 올릴 수 있어요.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`파일은 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB 이하여야 해요.`);
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.set("confirmed", String(confirmed));
      form.set("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const body = await res.json();

      if (body.status !== "uploaded") {
        setError(body.message ?? "자료를 올리지 못했어요. 잠시 후 다시 시도하세요.");
        return;
      }
      const doc = body.doc as UploadedDoc;
      if (totalChunks + doc.chunks.length > MAX_UPLOAD_CHUNKS_TOTAL) {
        setError("올린 자료의 분량이 너무 많아요. 올린 자료를 일부 지운 뒤 다시 올려 주세요.");
        return;
      }
      onAdd(doc);
    } catch {
      setError("자료를 올리지 못했어요. 연결을 확인하고 다시 시도하세요.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <section
      aria-label="내 자료 추가"
      className="flex flex-col gap-3 rounded-md border border-zinc-300 p-4 dark:border-zinc-700"
    >
      <div>
        <h2 className="font-medium">내 자료 추가 (선택)</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          새출발기금과 관련된 공개 PDF를 올리면 답변의 근거로 함께 씁니다. 새출발기금과 관련 없는 질문은 올린 자료에 답이 있어도 답변할 수 없어요. PDF만, 파일당 {MAX_UPLOAD_BYTES / 1024 / 1024}MB 이하, 최대{" "}
          {MAX_UPLOAD_FILES}개까지, 글자가 있는 PDF만 가능해요(스캔본 불가).
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-1"
        />
        <span>공개된 자료이며, 대외비·개인정보가 들어 있지 않음을 확인했습니다.</span>
      </label>

      <div>
        <label htmlFor="pdf-upload" className="sr-only">
          PDF 파일 선택
        </label>
        <input
          ref={fileInput}
          id="pdf-upload"
          type="file"
          accept="application/pdf,.pdf"
          disabled={!confirmed || uploading || full}
          onChange={handleFile}
          className="text-sm file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-transparent file:px-3 file:py-1.5 disabled:opacity-50 dark:file:border-zinc-700"
        />
        {uploading && <p className="mt-2 text-sm text-zinc-500">자료를 읽는 중이에요…</p>}
        {full && <p className="mt-2 text-sm text-zinc-500">자료는 {MAX_UPLOAD_FILES}개까지 올릴 수 있어요.</p>}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {docs.length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {docs.map((doc) => (
            <li key={doc.docId} className="flex items-center justify-between gap-3 rounded-md bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
              <span className="min-w-0 truncate">
                {doc.name} <span className="text-zinc-500">· {doc.chunks.length}조각</span>
              </span>
              <button
                type="button"
                onClick={() => onRemove(doc.docId)}
                className="shrink-0 rounded-md border border-zinc-300 px-2 py-0.5 hover:bg-zinc-200 dark:border-zinc-600 dark:hover:bg-zinc-700"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-zinc-500">
        올린 자료는 이 브라우저 화면에만 있고 서버에 저장되지 않아요. 새로고침하면 사라지고, 다른 사람은 볼 수 없어요. 다만
        답변을 만들 때 내용이 외부 AI 서비스(OpenAI)로 전송돼요.
      </p>
    </section>
  );
}
