// OpenAI 연결 확인 (PLAN 11번). 모델 목록만 조회하므로 요금이 나오지 않는다.
// 실행: node --env-file=.env scripts/check-openai.mjs
// API 키 값은 화면에 출력하지 않는다.
import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY가 .env에 없습니다.");
  process.exit(1);
}

try {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const page = await client.models.list();
  console.log(`✅ OpenAI 연결 성공: 사용 가능한 모델 ${page.data.length}개 확인`);

  const wanted = ["text-embedding-3-large", process.env.OPENAI_MODEL].filter(Boolean);
  const available = new Set(page.data.map((model) => model.id));
  for (const id of wanted) {
    console.log(`${available.has(id) ? "✅" : "⚠"} ${id}: ${available.has(id) ? "사용 가능" : "목록에 없음"}`);
  }
  if (!process.env.OPENAI_MODEL) {
    console.log("ℹ OPENAI_MODEL은 아직 .env에 없습니다 (답변 생성 단계 전에 추가).");
  }
} catch (error) {
  const status = error?.status ? ` (HTTP ${error.status})` : "";
  console.error(`❌ OpenAI 연결 실패${status}: ${error?.message ?? error}`);
  process.exit(1);
}
