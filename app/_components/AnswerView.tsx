"use client";

// Design Ref: §4·§8·§14 — ④ 답변 영역: 결론 배지 → 결론 한 줄 → 설명(문장별 근거 번호) → 예외·주의 → 해석 1·2 → 용어 불일치 → 근거 목록,
// 또는 근거 없음·오류 화면. [답변 복사]로 질문·답변·근거를 한 번에 복사한다.
import { useEffect, useRef, useState } from "react";
import { VERDICT_LABEL, formatCopyText } from "@/lib/answerText";
import type { AnswerPoint, AnswerResponse, AskResponse, ErrorCode, Source, Verdict } from "@/lib/askResponse";

export type AnswerState =
  | { kind: "idle" }
  | { kind: "loading"; slow: boolean }
  | { kind: "done"; question: string; response: AskResponse }
  | { kind: "failed"; timedOut: boolean };

const UNAVAILABLE_MESSAGE = "지금은 답변할 수 없습니다. 잠시 후 다시 시도하세요.";

// 다시 보내면 나아질 수 있는 오류에만 [다시 시도]를 보여준다.
const RETRYABLE_CODES: ErrorCode[] = ["AI_ERROR", "AI_TIMEOUT"];
// (UPLOAD_INVALID·UPLOAD_BLOCKED는 올린 자료를 지워야 해결되므로 다시 시도 버튼을 보이지 않는다)

const VERDICT_STYLE: Record<Verdict, string> = {
  possible: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  impossible: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100",
  conditional: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  info: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
};

type AnswerViewProps = {
  state: AnswerState;
  onRetry: () => void;
};

export default function AnswerView({ state, onRetry }: AnswerViewProps) {
  return (
    <section
      aria-live="polite"
      aria-busy={state.kind === "loading"}
      className="min-h-32 rounded-md border border-dashed border-zinc-300 p-4 dark:border-zinc-700"
    >
      <h2 className="mb-2 font-medium">답변</h2>
      <AnswerBody state={state} onRetry={onRetry} />
    </section>
  );
}

function AnswerBody({ state, onRetry }: AnswerViewProps) {
  switch (state.kind) {
    case "idle":
      return <p className="text-zinc-500">질문을 입력하면 여기에 답변이 표시됩니다.</p>;
    case "loading":
      return (
        <p className="text-zinc-500">
          {state.slow ? "답변이 늦어지고 있어요. 조금만 기다려 주세요…" : "답변을 준비하고 있어요…"}
        </p>
      );
    case "failed":
      return <ErrorMessage message={UNAVAILABLE_MESSAGE} onRetry={onRetry} />;
    case "done": {
      const { response } = state;
      if (response.status === "error") {
        return (
          <ErrorMessage
            message={response.message}
            onRetry={RETRYABLE_CODES.includes(response.code) ? onRetry : undefined}
          />
        );
      }
      if (response.status === "out_of_scope") {
        return (
          <div role="status" className="flex flex-col gap-1 rounded-md border border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="font-semibold">답변 불가</p>
            <p className="text-zinc-700 dark:text-zinc-300">{response.headline}</p>
          </div>
        );
      }
      if (response.status === "no_evidence") {
        return <p className="text-zinc-700 dark:text-zinc-300">{response.answer}</p>;
      }
      return <StructuredAnswer question={state.question} response={response} />;
    }
  }
}

function StructuredAnswer({ question, response }: { question: string; response: AnswerResponse }) {
  const { verdict, headline, reasons, cautions, needsInquiry, ambiguous, interpretations, termMismatch, sources } = response;
  // 근거 번호를 누르면 그 근거를 강조하고 화면을 옮긴다.
  const [activeSource, setActiveSource] = useState<number | null>(null);

  function focusSource(number: number) {
    setActiveSource(number);
    document.getElementById(`source-${number}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          <span className={`rounded-full px-3 py-0.5 font-semibold ${VERDICT_STYLE[verdict]}`}>{VERDICT_LABEL[verdict]}</span>
          {ambiguous && <Badge>해석이 애매한 사안</Badge>}
          {termMismatch.length > 0 && <Badge>용어 불일치</Badge>}
        </div>
        <CopyButton question={question} response={response} />
      </div>

      <p className="text-lg font-semibold leading-8">{headline}</p>

      {reasons.length > 0 && (
        <ul className="flex flex-col gap-2 leading-7">
          {reasons.map((point, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true" className="text-zinc-400">
                •
              </span>
              <span>
                <PointText point={point} onSelect={focusSource} />
              </span>
            </li>
          ))}
        </ul>
      )}

      {cautions.length > 0 && (
        <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <p className="mb-1 font-medium">예외·주의</p>
          <ul className="flex flex-col gap-1 leading-6">
            {cautions.map((point, i) => (
              <li key={i}>
                <PointText point={point} onSelect={focusSource} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {needsInquiry && (
        <p className="rounded-md bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
          운영처 또는 사내 변호사에게 확인하세요. 해석이 갈리거나 근거가 일부뿐인 사안이에요.
        </p>
      )}

      {interpretations.length > 0 && (
        <ol className="flex flex-col gap-2">
          {interpretations.map((text, i) => (
            <li key={i} className="rounded-md bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
              <span className="font-medium">해석 {i + 1}</span> {text}
            </li>
          ))}
        </ol>
      )}

      {termMismatch.length > 0 && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          용어 불일치:{" "}
          {termMismatch.map(({ a, b }, i) => (
            <span key={i}>
              {i > 0 && ", "}“{a}” ↔ “{b}”
            </span>
          ))}
        </p>
      )}

      <section aria-label="근거" className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <h3 className="text-sm font-medium">근거</h3>
        <ol className="flex flex-col gap-3">
          {sources.map((source, i) => (
            <SourceItem key={source.id} source={source} number={i + 1} active={activeSource === i + 1} />
          ))}
        </ol>
      </section>
    </div>
  );
}

// 문장 뒤에 근거 번호 [1] [2]를 붙인다. 번호가 없으면 근거를 특정하지 못한 문장이다.
function PointText({ point, onSelect }: { point: AnswerPoint; onSelect: (number: number) => void }) {
  return (
    <>
      {point.text}
      {point.cites.map((number) => (
        <button
          key={number}
          type="button"
          onClick={() => onSelect(number)}
          aria-label={`근거 ${number}번 보기`}
          className="mx-0.5 align-super text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300"
        >
          [{number}]
        </button>
      ))}
    </>
  );
}

function SourceItem({ source, number, active }: { source: Source; number: number; active: boolean }) {
  return (
    <li
      id={`source-${number}`}
      className={`-m-2 flex flex-col gap-1 rounded-md p-2 text-sm ${active ? "bg-amber-50 ring-2 ring-amber-400 dark:bg-amber-950/30" : ""}`}
    >
      <p>
        <span className="font-semibold">[{number}]</span> {source.source} · {source.item}
      </p>
      <p className="text-zinc-500">
        {source.url ? (
          <>
            기준일 {source.baseDate} ·{" "}
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">
              원문 보기
            </a>
          </>
        ) : (
          <>업로드일 {source.baseDate} · 이 브라우저에만 있는 자료</>
        )}
      </p>
      <blockquote className="border-l-2 border-zinc-300 pl-3 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">
        {source.excerpt}
      </blockquote>
    </li>
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 클립보드 권한이 없는 환경에서는 임시 입력칸으로 복사한다.
    try {
      const box = document.createElement("textarea");
      box.value = text;
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      const ok = document.execCommand("copy");
      box.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function CopyButton({ question, response }: { question: string; response: AnswerResponse }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function handleCopy() {
    const today = new Date().toLocaleDateString("en-CA");
    const ok = await copyToClipboard(formatCopyText(question, response, today));
    setStatus(ok ? "copied" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded-md border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      {status === "copied" ? "복사했어요" : status === "failed" ? "복사하지 못했어요" : "답변 복사"}
    </button>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-amber-100 px-3 py-0.5 font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
      {children}
    </span>
  );
}

function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-red-600 dark:text-red-400">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
