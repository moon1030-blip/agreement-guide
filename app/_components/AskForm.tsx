"use client";

// Design Ref: §4 — ③ 질문 입력과 ④ 답변 영역의 뼈대. 입력 검사(PLAN 8번)와 서버 연결(PLAN 10번)은 이후에 붙인다.
import { useState } from "react";
import AnswerView from "./AnswerView";

// 임시 예시 질문. 공개 자료를 모으면(PLAN 2번) 자료에 답이 있는 질문으로 바꾼다.
const EXAMPLE_QUESTIONS = [
  "새출발기금 신청 대상은 누구인가요?",
  "채무조정 신청은 어떤 절차로 진행되나요?",
  "신청할 때 필요한 서류는 무엇인가요?",
];

export default function AskForm() {
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;
    setSubmitted(trimmed);
  }

  return (
    <>
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
          className="w-full resize-y rounded-md border border-zinc-300 p-3 dark:border-zinc-700 dark:bg-zinc-900"
        />
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
            disabled={!question.trim()}
            className="rounded-md bg-foreground px-5 py-2 text-background disabled:opacity-40"
          >
            질문하기
          </button>
        </div>
      </form>
      <AnswerView question={submitted} />
    </>
  );
}
