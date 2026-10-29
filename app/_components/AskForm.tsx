"use client";

// Design Ref: §4·§5.2 — ③ 질문 입력과 ④ 답변 영역. 질문을 /api/ask로 보내고 결과를 보여준다.
import { useState } from "react";
import type { AskResponse } from "@/lib/askResponse";
import type { UploadedDoc } from "@/lib/uploadTypes";
import {
  MAX_QUESTION_LENGTH,
  mentionsAgreementText,
  validateQuestion,
} from "@/lib/validate";
import AnswerView, { type AnswerState } from "./AnswerView";
import UploadPanel from "./UploadPanel";

// 임시 예시 질문. 공개 자료를 모으면(PLAN 2번) 자료에 답이 있는 질문으로 바꾼다.
const EXAMPLE_QUESTIONS = [
  "새출발기금 신청 대상은 누구인가요?",
  "채무조정 신청은 어떤 절차로 진행되나요?",
  "신청할 때 필요한 서류는 무엇인가요?",
];

const AGREEMENT_CONFIRM_MESSAGE =
  "질문에 '제○조'나 '별첨'이 들어 있어요.\n협약 원문을 붙여넣은 것이 아닌지 확인하세요.\n\n협약 원문이 아니라면 [확인]을 눌러 보내세요.";

// Design Ref: §8 — 10초가 지나면 지연 안내, 30초가 지나면 요청을 멈춘다.
const SLOW_NOTICE_MS = 10_000;
const TIMEOUT_MS = 30_000;

export default function AskForm() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AnswerState>({ kind: "idle" });
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  // Design §13: 올린 자료는 이 화면의 메모리에만 두고, 질문을 보낼 때마다 함께 보낸다. 새로고침하면 사라진다.
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const loading = answer.kind === "loading";

  // 입력 중에 바로 검사해, 개인정보로 보이는 숫자가 있으면 보내기 전에 막는다.
  const validation = validateQuestion(question);
  const inputError =
    !validation.ok && validation.code === "PERSONAL_INFO" ? validation.message : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validation.ok || loading) return;
    if (mentionsAgreementText(validation.question) && !window.confirm(AGREEMENT_CONFIRM_MESSAGE)) {
      return;
    }

    await send(validation.question);
  }

  async function send(text: string) {
    setLastQuestion(text);
    setAnswer({ kind: "loading", slow: false });

    const controller = new AbortController();
    const slowTimer = setTimeout(() => {
      setAnswer((prev) => (prev.kind === "loading" ? { kind: "loading", slow: true } : prev));
    }, SLOW_NOTICE_MS);
    const timeoutTimer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(docs.length > 0 ? { question: text, uploaded: docs } : { question: text }),
        signal: controller.signal,
      });
      const response = (await res.json()) as AskResponse;
      setAnswer({ kind: "done", question: text, response });
    } catch {
      setAnswer({ kind: "failed", timedOut: controller.signal.aborted });
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(timeoutTimer);
    }
  }

  function handleRetry() {
    if (lastQuestion && !loading) void send(lastQuestion);
  }

  return (
    <>
      <UploadPanel
        docs={docs}
        onAdd={(doc) => setDocs((prev) => [...prev, doc])}
        onRemove={(docId) => setDocs((prev) => prev.filter((doc) => doc.docId !== docId))}
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="question" className="font-medium">
          질문
        </label>
        <textarea
          id="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="궁금한 상황을 문장으로 입력하세요"
          rows={4}
          maxLength={MAX_QUESTION_LENGTH}
          aria-invalid={inputError ? true : undefined}
          aria-describedby="question-help"
          className="w-full resize-y rounded-md border border-zinc-300 p-3 aria-invalid:border-red-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div id="question-help" className="flex items-start justify-between gap-4 text-sm">
          <p role="alert" className="text-red-600 dark:text-red-400">
            {inputError}
          </p>
          <p className="shrink-0 text-zinc-500">
            {question.length}/{MAX_QUESTION_LENGTH}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-500">예시 질문:</span>
          {EXAMPLE_QUESTIONS.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setQuestion(example)}
              className="rounded-full border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {example}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!validation.ok || loading}
            className="rounded-md bg-foreground px-5 py-2 text-background disabled:opacity-40"
          >
            {loading ? "답변 중…" : "질문하기"}
          </button>
        </div>
      </form>
      <AnswerView state={answer} onRetry={handleRetry} />
    </>
  );
}
