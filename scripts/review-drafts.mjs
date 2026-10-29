// 수집한 초안(data/draft)을 자동 검사하고, 사람이 확인한 뒤 앱 자료(data/raw)로 옮긴다 (DESIGN §12.2 B안·§12.6).
// 실행: npm run review:drafts                       초안 목록과 검사 결과만 본다 (아무것도 옮기지 않음)
//       npm run review:drafts -- --approve           막힘이 없는 초안을 전부 data/raw로 옮긴다
//       npm run review:drafts -- --approve=파일이름   그 초안만 옮긴다 (예: fsc-2026-06-25-87188.md)
//       npm run review:drafts -- --dir=data/raw      이미 반영된 자료를 같은 기준으로 다시 검사한다 (옮기지 않음)
// 자동 검사는 사람의 확인을 대신하지 않는다. 숫자·날짜·기관 이름이 원문과 같은지는 원문을 열어 직접 확인한다.
import { mkdir, readdir, readFile, rename } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const dirArg = args.find((a) => a.startsWith("--dir="))?.split("=")[1];
const approveArg = args.find((a) => a === "--approve" || a.startsWith("--approve="));
const DRAFT_DIR = dirArg ?? "data/draft";
const RAW_DIR = "data/raw";
const approveOnly = approveArg?.includes("=") ? approveArg.split("=")[1] : null;

// 막힘(BLOCK): 있으면 옮기지 않는다. 주의(WARN): 사람이 보고 판단한다.
function inspect(text) {
  const block = [];
  const warn = [];
  const front = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!front) block.push("맨 위 자료 정보(---)가 없음");
  const body = front ? text.slice(front[0].length) : text;
  const items = body.split(/^## /m).slice(1);
  if (items.length === 0) block.push("## 항목이 하나도 없음");

  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(body)) block.push("이메일 주소가 남아 있음");
  if (/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/.test(body)) block.push("휴대전화 번호가 남아 있음");
  if (/\d{6}-?[1-4]\d{6}/.test(body)) block.push("주민등록번호 형식이 있음");
  if (/대외비|사외비|내부용|내부자료|Confidential/i.test(body)) block.push("대외비 표시 문구가 있음");
  if (!/새출발기금|채무조정/.test(body)) warn.push("새출발기금·채무조정이라는 말이 본문에 없음 (관계없는 글이 섞였을 수 있음)");
  if (/담당\s*부서|책임자|담당자/.test(body)) warn.push("담당 부서·담당자 표기가 남아 있음 (이름·연락처는 지워야 함)");
  if (/\d{2,4}-\d{3,4}-\d{4}/.test(body)) warn.push("전화번호 모양이 있음 (기관 대표번호 등 공개 안내번호가 아닌지 확인)");

  const long = items.filter((item) => item.length > 1000).length;
  if (long > 0) warn.push(`1,000자를 넘는 항목 ${long}개 (여러 이야기가 섞였는지 확인)`);
  const short = items.filter((item) => item.length < 80).length;
  if (short > 0) warn.push(`80자 미만 항목 ${short}개 (소제목만 남았는지 확인)`);
  if (/(\S+\s+){6,}\n?.*\|/.test(body) || /(구분|제출서류|발급기관)\s+\S+\s+\S+\s+(구분|제출서류|발급기관)/.test(body)) {
    warn.push("표가 글자로 풀린 것 같음 (줄 순서가 섞이지 않았는지 확인)");
  }
  return { block, warn, items: items.length };
}

const names = (await readdir(DRAFT_DIR).catch(() => [])).filter((n) => n.endsWith(".md") && n !== "README.md" && n !== "_template.md");
if (names.length === 0) {
  console.log(`${DRAFT_DIR}에 검토할 초안이 없습니다.`);
  process.exit(0);
}

let blocked = 0;
const ready = [];
for (const name of names.sort()) {
  const { block, warn, items } = inspect(await readFile(path.join(DRAFT_DIR, name), "utf8"));
  const mark = block.length > 0 ? "⛔" : warn.length > 0 ? "⚠ " : "✅";
  console.log(`${mark} ${name}  (항목 ${items}개)`);
  for (const line of block) console.log(`     막힘: ${line}`);
  for (const line of warn) console.log(`     주의: ${line}`);
  if (block.length > 0) blocked++;
  else ready.push(name);
}

console.log(`\n초안 ${names.length}개: 옮길 수 있음 ${ready.length}개, 막힘 ${blocked}개`);
console.log("확인할 것 (DESIGN §12.6): 숫자·날짜·기관 이름이 원문과 같은가 / 한 항목에 한 주제인가 / 담당자 정보가 없는가 / 관계없는 내용이 없는가 / 첨부에만 있는 중요한 내용이 있는가");

if (dirArg) {
  console.log("--dir로 검사만 했고 아무것도 옮기지 않았습니다.");
  process.exit(blocked > 0 ? 1 : 0);
}
if (!approveArg) {
  console.log("원문과 대조해 문제가 없으면: npm run review:drafts -- --approve   (또는 --approve=파일이름)");
  process.exit(0);
}

await mkdir(RAW_DIR, { recursive: true });
const targets = approveOnly ? ready.filter((n) => n === approveOnly) : ready;
if (approveOnly && targets.length === 0) {
  console.error(`❌ ${approveOnly}은(는) 옮길 수 있는 초안 목록에 없습니다 (이름이 틀렸거나 막힘이 있음).`);
  process.exit(1);
}
for (const name of targets) await rename(path.join(DRAFT_DIR, name), path.join(RAW_DIR, name));
console.log(`\n✅ ${targets.length}개를 ${RAW_DIR}로 옮겼습니다. 이어서 npm run build:chunks → npm run build:index 를 실행하세요.`);
