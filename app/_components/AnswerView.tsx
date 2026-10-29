// Design Ref: §4·§8 — ④ 답변 영역: 표시 배지 → 답변 → 해석 1·2 → 용어 불일치 → 근거 목록, 또는 근거 없음·오류 화면.
import type { AnswerResponse, AskResponse, ErrorCode, Source } from "@/lib/askResponse";

export type AnswerState =
  | { kind: "idle" }
  | { kind: "loading"; slow: boolean }
  | { kind: "done"; response: AskResponse }
  | { kind: "failed"; timedOut: boolean };

const UNAVAILABLE_MESSAGE = "지금은 답변할 수 없습니다. 잠시 후 다시 시도하세요.";

// 다시 보내면 나아질 수 있는 오류에만 [다시 시도]를 보여준다.
const RETRYABLE_CODES: ErrorCode[] = ["AI_ERROR", "AI_TIMEOUT"];

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
      return <Answer response={response} />;
    }
  }
}

function Answer({ response }: { response: AnswerResponse }) {
  if (response.status === "no_evidence") {
    return <p className="text-zinc-700 dark:text-zinc-300">{response.answer}</p>;
  }

  const { answer, ambiguous, interpretations, termMismatch, sources } = response;
  return (
    <div className="flex flex-col gap-4">
      {(ambiguous || termMismatch.length > 0) && (
        <div className="flex flex-wrap gap-2 text-sm">
          {ambiguous && <Badge>해석이 애매한 사안</Badge>}
          {termMismatch.length > 0 && <Badge>용어 불일치</Badge>}
        </div>
      )}

      <p className="whitespace-pre-line leading-7">{answer}</p>

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
            <SourceItem key={source.id} source={source} index={i + 1} />
          ))}
        </ol>
      </section>
    </div>
  );
}

function SourceItem({ source, index }: { source: Source; index: number }) {
  return (
    <li className="flex flex-col gap-1 text-sm">
      <p>
        <span className="font-medium">{index}.</span> {source.source} · {source.item}
      </p>
      <p className="text-zinc-500">
        기준일 {source.baseDate} ·{" "}
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">
          원문 보기
        </a>
      </p>
      <blockquote className="border-l-2 border-zinc-300 pl-3 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">
        {source.excerpt}
      </blockquote>
    </li>
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
