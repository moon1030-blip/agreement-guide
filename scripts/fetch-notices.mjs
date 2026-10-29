// 새출발기금 홈페이지 공지사항을 모아 data/raw/notice-번호.md 초안을 만든다.
// 실행: npm run fetch:notices   (옵션: --dry-run 파일을 쓰지 않고 목록만 보기)
// 이미 있는 글(notice-번호.md)은 건너뛴다. 본문이 그림·첨부파일(hwp/pdf)뿐인 글은 글자가 없어 수집하지 않고 목록으로 알려 준다.
// 모은 뒤: npm run build:chunks → npm run build:index
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = "https://www.newstartfund.or.kr";
const RAW_DIR = "data/raw";
const dryRun = process.argv.includes("--dry-run");
const MIN_TEXT = 60;
const MAX_ITEM = 900;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getHtml(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; gyeopyak-gilzabi-collector)" } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

const decode = (s) =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function toLines(html) {
  return decode(html.replace(/<(br|\/p|\/div|\/tr|\/li)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " "))
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

async function listIds() {
  const found = new Map();
  for (let page = 1; page <= 10; page++) {
    const html = await getHtml(`${BASE}/Board/List.do?pageIndex=${page}`);
    const before = found.size;
    for (const m of html.matchAll(/fn_view\((\d+)\)'>/g)) found.set(m[1], true);
    if (found.size === before) break;
    await sleep(1000);
  }
  return [...found.keys()];
}

async function readNotice(id) {
  const html = await getHtml(`${BASE}/Board/View.do?idx=${id}`);
  const head = html.match(/<div class="vp_header">[\s\S]*?<\/li><li>([\s\S]*?)<\/li>/);
  const date = html.match(/작성일<\/span><\/li><li>\s*(\d{4}-\d{2}-\d{2})/);
  const body = html.match(/<div class="vp_contents">([\s\S]*?)<\/div>\s*<\/div>\s*<button/);
  if (!head || !date || !body) throw new Error(`공지 ${id}: 화면 구조를 읽지 못했습니다.`);
  const title = toLines(head[1]).join(" ").replace(/^\[중요\]\s*/, "");
  // 첨부파일 이름 줄(board_file)은 본문이 아니므로 뺀다. 이메일은 넣지 않는다.
  const lines = toLines(body[1].replace(/<div class="board_file">[\s\S]*?<\/div>/g, "")).filter((line) => !/@/.test(line));
  return { id, title, date: date[1], lines };
}

function packItems(lines) {
  const items = [];
  let current = "";
  for (const line of lines) {
    if (current && current.length + line.length > MAX_ITEM) {
      items.push(current);
      current = "";
    }
    current += (current ? "\n" : "") + line;
  }
  if (current) items.push(current);
  return items;
}

const toMarkdown = (post) => {
  const items = packItems(post.lines);
  const sections = items.map((text, i) => `## 공지 · ${post.title}${items.length > 1 ? ` (${i + 1}/${items.length})` : ""}\n\n${text}\n`);
  return `---\nsource: 새출발기금 홈페이지 공지사항 「${post.title}」\nurl: ${BASE}/Board/View.do?idx=${post.id}\nbaseDate: ${post.date}\n---\n\n${sections.join("\n")}`;
};

const have = new Set((await readdir(RAW_DIR)).map((name) => name.match(/^notice-(\d+)\.md$/)?.[1]).filter(Boolean));
const ids = await listIds();
console.log(`공지사항 ${ids.length}건 발견, 이미 수집 ${have.size}건`);
const skipped = [];
let written = 0;
for (const id of ids.filter((x) => !have.has(x))) {
  await sleep(700);
  const post = await readNotice(id);
  const textLength = post.lines.join("").length;
  if (textLength < MIN_TEXT) {
    skipped.push(`${post.date} ${post.title} (글자 ${textLength}자, 그림·첨부파일 위주)`);
    continue;
  }
  if (!dryRun) await writeFile(path.join(RAW_DIR, `notice-${id}.md`), toMarkdown(post), "utf8");
  written++;
  console.log(`${dryRun ? "[시험] " : ""}notice-${id}.md  ${post.date}  ${post.title}  (${textLength}자)`);
}
console.log(`\n새로 만든 파일 ${written}개, 건너뜀 ${skipped.length}건 (글자가 없는 글):`);
for (const line of skipped) console.log(" - " + line);
