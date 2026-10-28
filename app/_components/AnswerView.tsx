// Design Ref: §4 — ④ 답변 영역의 뼈대. 답변·근거·애매/불일치 표시는 PLAN 15번, 오류 화면은 16번에서 채운다.
type AnswerViewProps = {
  question: string | null;
};

export default function AnswerView({ question }: AnswerViewProps) {
  return (
    <section
      aria-live="polite"
      className="min-h-32 rounded-md border border-dashed border-zinc-300 p-4 dark:border-zinc-700"
    >
      <h2 className="mb-2 font-medium">답변</h2>
      {question ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          답변 기능은 준비 중입니다. (보낸 질문: {question})
        </p>
      ) : (
        <p className="text-zinc-500">질문을 입력하면 여기에 답변이 표시됩니다.</p>
      )}
    </section>
  );
}
