// data/chunks.json의 항목마다 "뜻 지문"(OpenAI 임베딩)을 만들어 data/embeddings.json에 저장한다 (PLAN 12번).
// Design Ref: §3·§5.1 — 공개 자료가 바뀔 때 build:chunks 다음에 한 번 실행한다.
// 실행: npm run build:index   (요금: 항목 수십 개 기준 1센트 미만)
//
// 항목마다 지문을 두 개 만든다.
//  - full: 제목 + 본문 (내용으로 찾기)
//  - title: 제목만 (질문과 질문을 맞대어 찾기)
//  - lead: 본문 첫 줄(120자까지) — 여러 이야기가 섞인 긴 항목에서 첫 문장이 말하는 핵심(예: "신청기간을 26년말까지 연장")이 희석되지 않게 한다
// 검색할 때는 둘 중 높은 점수를 쓴다. 보정 결과 이 방식이 "깎아→감면", "독촉→추심"처럼
// 표현이 다른 질문도 더 잘 찾았다. 문단별 지문도 시험했지만 오히려 순위가 흐트러져 쓰지 않는다.
// 같은 단어가 본문에만 있는 경우는 lib/retrieve.ts의 글자 겹침 점수가 맡는다.
import { readFile, writeFile } from "node:fs/promises";
import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-large";
const DIMENSIONS = 1536;
const BATCH_SIZE = 100;

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY가 .env에 없습니다.");
  process.exit(1);
}

const chunks = JSON.parse(await readFile("data/chunks.json", "utf8"));
if (chunks.length === 0) {
  console.error("❌ data/chunks.json이 비어 있습니다. 먼저 npm run build:chunks를 실행하세요.");
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 파일 크기를 줄이려고 소수점 5자리까지만 남긴다.
const round = (vector) => vector.map((v) => Math.round(v * 1e5) / 1e5);

async function embed(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const res = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      dimensions: DIMENSIONS,
      input: texts.slice(i, i + BATCH_SIZE),
    });
    out.push(...res.data.map((row) => round(row.embedding)));
  }
  return out;
}

// 본문 첫 줄에서 앞의 기호를 떼고 120자까지.
const leadOf = (text) => text.split("\n")[0].replace(/^[\s✓□○◦●·•\-–※*➊-➓①-⑳▲▶▷]+/, "").slice(0, 120);

const vectors = [];
try {
  const [full, title, lead] = await Promise.all([
    embed(chunks.map((chunk) => `${chunk.item}\n${chunk.text}`)),
    embed(chunks.map((chunk) => chunk.item)),
    embed(chunks.map((chunk) => leadOf(chunk.text))),
  ]);
  chunks.forEach((chunk, i) => vectors.push({ id: chunk.id, full: full[i], title: title[i], lead: lead[i] }));
} catch (error) {
  const status = error?.status ? ` (HTTP ${error.status})` : "";
  console.error(`❌ 임베딩 생성 실패${status}: ${error?.message ?? error}`);
  process.exit(1);
}

await writeFile(
  "data/embeddings.json",
  JSON.stringify({ model: EMBEDDING_MODEL, dimensions: DIMENSIONS, vectors }) + "\n",
  "utf8",
);
console.log(`✅ 항목 ${vectors.length}개의 뜻 지문을 data/embeddings.json에 저장했습니다.`);
