// Design Ref: §4 — 화면 구성. 경고 상자·범위 안내·예시 질문·자료 기준일은 PLAN 7번에서 채운다.
import AskForm from "./_components/AskForm";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">협약 길잡이</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          공개 자료 범위 안에서만 답합니다
        </p>
      </header>
      <AskForm />
    </main>
  );
}
