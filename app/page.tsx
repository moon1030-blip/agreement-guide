// Design Ref: §4 — 화면 구성의 머리글 자리. 경고 상자·질문 입력·답변 영역은 PLAN 6~7번에서 채운다.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-2 px-4 py-12">
      <h1 className="text-3xl font-semibold">협약 길잡이</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        공개 자료 범위 안에서만 답합니다
      </p>
    </main>
  );
}
