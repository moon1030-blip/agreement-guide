// 점검용 질문 세트(data/eval/questions.json)를 실행 중인 서버에 하나씩 보내 성공 기준을 잰다 (PLAN 18번).
// 실행: 먼저 npm run dev로 서버를 켠 뒤  npm run eval
// 질문 25개가 하루 질문 한도(100건)를 쓰므로, 한도가 걱정되면 서버를 다시 켠 뒤 실행한다.
// 정답률은 사람이 채점한다(PRD 3번). 이 스크립트는 응답을 data/eval/results.json에 모아 채점표를 만든다.
import { readFile, writeFile } from "node:fs/promises";

const BASE_URL = process.env.EVAL_URL ?? "http://localhost:3000";
const TIME_LIMIT_SEC = 10;
const questions = JSON.parse(await readFile("data/eval/questions.json", "utf8"));

const results = [];
for (const [index, item] of questions.entries()) {
  const started = performance.now();
  let http = 0;
  let body = null;
  try {
    const res = await fetch(`${BASE_URL}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: item.question }),
    });
    http = res.status;
    body = await res.json();
  } catch {
    console.error(`❌ 서버에 연결하지 못했습니다 (${BASE_URL}). npm run dev가 켜져 있는지 확인하세요.`);
    process.exit(1);
  }
  const seconds = Math.round(((performance.now() - started) / 1000) * 10) / 10;
  const sourceIds = (body.sources ?? []).map((source) => source.id);
  const shouldBeNoEvidence = item.expectedSourceIds.length === 0;

  results.push({
    no: index + 1,
    question: item.question,
    expected: item.expected,
    expectedSourceIds: item.expectedSourceIds,
    http,
    status: body.status,
    code: body.code,
    seconds,
    answer: body.answer,
    ambiguous: body.ambiguous ?? false,
    interpretations: body.interpretations ?? [],
    termMismatch: body.termMismatch ?? [],
    sources: (body.sources ?? []).map((source) => ({
      id: source.id,
      item: source.item,
      source: source.source,
      baseDate: source.baseDate,
      url: source.url,
      excerptLength: source.excerpt?.length ?? 0,
    })),
    // 자동 판정 (정답 채점과는 별개)
    kind: shouldBeNoEvidence ? "no_evidence_expected" : "answerable",
    sourcesComplete: (body.sources ?? []).every((s) => s.id && s.source && s.item && s.baseDate && s.url && s.excerpt),
    expectedSourceFound: shouldBeNoEvidence ? null : item.expectedSourceIds.some((id) => sourceIds.includes(id)),
    gotNoEvidence: body.status === "no_evidence",
  });
  console.log(`${String(index + 1).padStart(2)}/${questions.length} ${seconds}초 ${body.status ?? body.code} | ${item.question.slice(0, 40)}`);
}

const answerable = results.filter((r) => r.kind === "answerable");
const noEvidence = results.filter((r) => r.kind === "no_evidence_expected");
const answered = results.filter((r) => r.status === "answered");

const summary = {
  runAt: new Date().toISOString(),
  total: results.length,
  responseTime: {
    averageSec: Math.round((results.reduce((sum, r) => sum + r.seconds, 0) / results.length) * 10) / 10,
    maxSec: Math.max(...results.map((r) => r.seconds)),
    over10sec: results.filter((r) => r.seconds > TIME_LIMIT_SEC).length,
  },
  sourceDisplay: {
    answeredCount: answered.length,
    withCompleteSources: answered.filter((r) => r.sources.length > 0 && r.sourcesComplete).length,
  },
  noEvidence: {
    questions: noEvidence.length,
    gotNoEvidence: noEvidence.filter((r) => r.gotNoEvidence).length,
  },
  answerable: {
    questions: answerable.length,
    answered: answerable.filter((r) => r.status === "answered").length,
    wrongNoEvidence: answerable.filter((r) => r.gotNoEvidence).length,
    expectedSourceFound: answerable.filter((r) => r.expectedSourceFound).length,
  },
  errors: results.filter((r) => r.status === "error").length,
};

await writeFile("data/eval/results.json", JSON.stringify({ summary, results }, null, 2) + "\n", "utf8");
console.log("\n" + JSON.stringify(summary, null, 2));
console.log("\n결과를 data/eval/results.json에 저장했습니다.");
