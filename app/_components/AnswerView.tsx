// Design Ref: §4 — ④ 답변 영역. 근거·애매/불일치 표시는 PLAN 15번, 지연 안내·다시 시도는 16번에서 채운다.
import type { AskResponse } from "@/lib/askResponse";

export type AnswerState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; response: AskResponse }
  | { kind: "failed" };

const FAILED_MESSAGE = "지금은 답변할 수 없습니다. 잠시 후 다시 시도하세요.";

export default function AnswerView({ state }: { state: AnswerState }) {
  return (
    <section
      aria-live="polite"
      aria-busy={state.kind === "loading"}
      className="min-h-32 rounded-md border border-dashed border-zinc-300 p-4 dark:border-zinc-700"
    >
      <h2 className="mb-2 font-medium">답변</h2>
      <AnswerBody state={state} />
    </section>
  );
}

function AnswerBody({ state }: { state: AnswerState }) {
  switch (state.kind) {
    case "idle":
      return <p className="text-zinc-500">질문을 입력하면 여기에 답변이 표시됩니다.</p>;
    case "loading":
      return <p className="text-zinc-500">답변을 준비하고 있어요…</p>;
    case "failed":
      return <p className="text-red-600 dark:text-red-400">{FAILED_MESSAGE}</p>;
    case "done": {
      const { response } = state;
      if (response.status === "error") {
        return <p className="text-red-600 dark:text-red-400">{response.message}</p>;
      }
      return <p className="whitespace-pre-line">{response.answer}</p>;
    }
  }
}
