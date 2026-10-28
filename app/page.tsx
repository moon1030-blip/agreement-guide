// Design Ref: §4 — 화면 구성: ① 머리글 → ② 경고 상자 → ③ 질문 입력 → ④ 답변 영역
import AskForm from "./_components/AskForm";
import Notice from "./_components/Notice";

// 공개 자료를 모으면(PLAN 2번) 실제 기준일로 바꾼다.
const DATA_BASE_DATE = "공개 자료 수집 후 표시";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">협약 길잡이</h1>
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-zinc-600 dark:text-zinc-400">
          <p>공개 자료 범위 안에서만 답합니다</p>
          <p className="text-sm">자료 기준일: {DATA_BASE_DATE}</p>
        </div>
      </header>
      <Notice />
      <AskForm />
    </main>
  );
}
