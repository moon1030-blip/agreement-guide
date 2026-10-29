// Design Ref: §14 — 구조화된 답변을 일반 글로 바꾼다. 서버는 `answer` 필드에, 화면은 [답변 복사]에 쓴다 (서버 전용 코드를 넣지 않는다).
import type { AnswerPoint, AnswerResponse, Verdict } from "./askResponse";

export const VERDICT_LABEL: Record<Verdict, string> = {
  possible: "가능",
  impossible: "불가",
  conditional: "조건부",
  info: "안내",
};

const citeMarks = (cites: number[]) => cites.map((n) => `[${n}]`).join("");

const pointLine = (prefix: string, point: AnswerPoint) =>
  `${prefix}${point.text}${point.cites.length > 0 ? " " + citeMarks(point.cites) : ""}`;

// 답변 본문만 이어 붙인 일반 글 (근거 목록 제외)
export function plainAnswer(parts: {
  headline: string;
  reasons: AnswerPoint[];
  cautions: AnswerPoint[];
  needsInquiry: boolean;
}): string {
  const lines = [parts.headline];
  if (parts.reasons.length > 0) lines.push("", ...parts.reasons.map((p) => pointLine("- ", p)));
  if (parts.cautions.length > 0) lines.push("", ...parts.cautions.map((p) => pointLine("※ ", p)));
  if (parts.needsInquiry) lines.push("", "※ 운영처 또는 사내 변호사에게 확인하세요.");
  return lines.join("\n");
}

// 업무 메모·보고서에 붙여넣을 수 있게 질문, 답변, 근거(자료명·기준일·주소·발췌)를 한 번에 정리한다.
export function formatCopyText(question: string, response: AnswerResponse, today: string): string {
  const lines = [`[협약 길잡이 답변] ${today}`, `질문: ${question}`, "", `결론: [${VERDICT_LABEL[response.verdict]}] ${response.headline}`];

  if (response.reasons.length > 0) lines.push("", ...response.reasons.map((p) => pointLine("- ", p)));
  if (response.cautions.length > 0) lines.push("", ...response.cautions.map((p) => pointLine("※ ", p)));
  if (response.ambiguous) lines.push("", "※ 해석이 애매한 사안입니다.");
  response.interpretations.forEach((text, i) => lines.push(`  해석 ${i + 1}: ${text}`));
  if (response.termMismatch.length > 0) {
    lines.push(`※ 용어 불일치: ${response.termMismatch.map(({ a, b }) => `"${a}" ↔ "${b}"`).join(", ")}`);
  }
  if (response.needsInquiry) lines.push("※ 운영처 또는 사내 변호사에게 확인하세요.");

  if (response.sources.length > 0) {
    lines.push("", "근거");
    response.sources.forEach((source, i) => {
      const where = source.url ? `기준일 ${source.baseDate}, ${source.url}` : `업로드일 ${source.baseDate}, 내가 올린 자료`;
      lines.push(`[${i + 1}] ${source.source} · ${source.item} (${where})`, `    "${source.excerpt}"`);
    });
  }

  lines.push("", "※ 공개 자료를 AI가 해석한 답변입니다. 업무에 쓰기 전에 원문을 확인하세요.");
  return lines.join("\n");
}
