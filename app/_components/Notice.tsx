// Design Ref: §4 — ② 경고 상자. PRD 7번(대외비 문구 입력 방지, 개인정보, 외부 AI 전송 고지)
export default function Notice() {
  return (
    <aside
      role="note"
      className="rounded-md border-2 border-amber-500 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <p className="text-lg font-semibold">⚠ 협약 원문을 붙여넣지 마세요</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        <li>채무자 이름·주민등록번호·계좌번호 등 개인정보를 입력하지 마세요.</li>
        <li>질문은 답변 생성을 위해 외부 AI 서비스(OpenAI)로 전송됩니다.</li>
      </ul>
    </aside>
  );
}
