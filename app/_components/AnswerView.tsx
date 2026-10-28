// Design Ref: §4·§8 — ④ 답변 영역. 근거·애매/불일치 표시는 PLAN 15번에서 채운다.
import type { AskResponse, ErrorCode } from "@/lib/askResponse";

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
      return <p className="whitespace-pre-line">{response.answer}</p>;
    }
  }
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
