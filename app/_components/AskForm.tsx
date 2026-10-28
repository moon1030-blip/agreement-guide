"use client";

// Design Ref: §4 — ③ 질문 입력과 ④ 답변 영역. 서버 연결(PLAN 10번)은 이후에 붙인다.
import { useState } from "react";
import {
  MAX_QUESTION_LENGTH,
  mentionsAgreementText,
  validateQuestion,
} from "@/lib/validate";
import AnswerView from "./AnswerView";

// 임시 예시 질문. 공개 자료를 모으면(PLAN 2번) 자료에 답이 있는 질문으로 바꾼다.
const EXAMPLE_QUESTIONS = [
  "새출발기금 신청 대상은 누구인가요?",
  "채무조정 신청은 어떤 절차로 진행되나요?",
  "신청할 때 필요한 서류는 무엇인가요?",
];

const AGREEMENT_CONFIRM_MESSAGE =
  "질문에 '제○조'나 '별첨'이 들어 있어요.\n협약 원문을 붙여넣은 것이 아닌지 확인하세요.\n\n협약 원문이 아니라면 [확인]을 눌러 보내세요.";

export default function AskForm() {
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  // 입력 중에 바로 검사해, 개인정보로 보이는 숫자가 있으면 보내기 전에 막는다.
  const validation = validateQuestion(question);
  const inputError =
    !validation.ok && validation.code === "PERSONAL_INFO" ? validation.message : null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validation.ok) return;
    if (mentionsAgreementText(validation.question) && !window.confirm(AGREEMENT_CONFIRM_MESSAGE)) {
      return;
    }
    setSubmitted(validation.question);
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
            disabled={!validation.ok}
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
