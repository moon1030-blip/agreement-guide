// 금융위원회 보도자료 게시판에서 "새출발기금" 글을 찾아, 아직 없는 글을 data/draft/fsc-게시일-번호.md 초안으로 만든다.
// Design Ref: §12 — 수집은 자동, 반영은 사람 검토 후. 이 스크립트는 초안만 만든다.
//
// 실행:  npm run fetch:fsc             (새 글만 가져옴)
//        npm run fetch:fsc -- --dry-run  (목록만 보고 파일은 만들지 않음)
//        npm run fetch:fsc -- --limit=3  (새 글 중 최대 3건만)
// 이어서: npm run build:chunks → npm run build:index  (자료 기준일과 검색 색인이 갱신된다)
//
// 이용 조건 (금융위원회 저작권정책, 2026-10-29 확인): 금융위원회가 저작재산권 전부를 가진 저작물은 별도 허락 없이 무료로 자유롭게 쓸 수 있고,
// 수익 목적이면 사전 협의가 필요하며, 모든 경우 출처가 금융위원회임을 밝혀야 한다. 다른 저작자와 권리를 나눈 자료는 복제·배포가 금지될 수 있다.
// 그래서 근거 목록에 출처(자료명·원문 주소)를 항상 보여 주고, 검토 때 외부 저작물이 섞였는지 확인한다.
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = "https://www.fsc.go.kr";
const RAW_DIR = "data/raw";
// 수집한 초안은 검토 전까지 앱 자료(data/raw)에 넣지 않는다. 검토·반영은 npm run review:drafts (DESIGN §12.2 B안).
const DRAFT_DIR = "data/draft";
const KEYWORD = "새출발기금";
const MAX_LIST_PAGES = 5;
const REQUEST_GAP_MS = 1000;
// 한 항목(## 하나)의 길이. 한 항목에 여러 이야기가 섞이면 검색이 잘 안 되므로 이 길이를 넘으면 나눈다 (점검 5번 교훈).
const TARGET_SECTION_CHARS = 500;
const MAX_SECTION_CHARS = 900;
const MIN_SECTION_CHARS = 30;
// 서버에 부담을 주지 않도록 요청 사이를 쉬고, 어떤 도구인지 알린다 (머리말은 영문·숫자만 쓸 수 있다).
const USER_AGENT = "gyeoryak-gilajabi-collector/0.1 (internal work tool; weekly; contact: owner)";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limit = Number(args.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? 50);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getHtml(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "ko" } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

// ---------- HTML → 글 ----------
const ENTITIES = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", middot: "·", hellip: "…", ldquo: "“", rdquo: "”",
  lsquo: "‘", rsquo: "’", ndash: "–", mdash: "—", rarr: "→", larr: "←", bull: "•", times: "×",
};
const decode = (text) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);

// 시작 표시가 있는 <div>의 안쪽 내용을 짝이 맞는 </div>까지 꺼낸다.
function balancedDiv(html, marker) {
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const open = html.indexOf(">", start) + 1;
  const tags = /<div\b|<\/div>/g;
  tags.lastIndex = open;
  let depth = 1;
  let match;
  while ((match = tags.exec(html))) {
    depth += match[0] === "</div>" ? -1 : 1;
    if (depth === 0) return html.slice(open, match.index);
  }
  return null;
}

function htmlToLines(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d|table|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decode(text)
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim());
}

// ---------- 목록 ----------
async function listPosts() {
  const posts = new Map();
  for (let page = 1; page <= MAX_LIST_PAGES; page++) {
    const url = `${BASE}/no010101?srchCtgry=&curPage=${page}&srchKey=sj&srchText=${encodeURIComponent(KEYWORD)}&srchBeginDt=&srchEndDt=`;
    const html = await getHtml(url);
    const before = posts.size;
    for (const match of html.matchAll(/<a[^>]+href="\/no010101\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) {
      const id = match[1];
      const title = decode(match[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
      if (title.includes(KEYWORD) && !posts.has(id)) posts.set(id, title);
    }
    if (posts.size === before) break; // 새 글이 더 없으면 멈춘다
    await sleep(REQUEST_GAP_MS);
  }
  return [...posts].map(([id, title]) => ({ id, title }));
}

// ---------- 상세 ----------
async function readPost(id) {
  const html = await getHtml(`${BASE}/no010101/${id}`);
  const subject = balancedDiv(html, '<div class="subject"');
  const day = html.match(/<div class="day">[\s\S]*?(20\d{2}-\d{2}-\d{2})/)?.[1];
  const cont = balancedDiv(html, '<div class="cont"');
  if (!subject || !day || !cont) throw new Error(`게시물 ${id}: 제목·날짜·본문 위치를 찾지 못했습니다 (사이트 구조가 바뀌었을 수 있습니다).`);

  const title = htmlToLines(subject).filter(Boolean).join(" ");
  return { id, title, date: day, lines: htmlToLines(cont) };
}

// ---------- 정리 ----------
const PHONE = /\d{2,4}[-)\s]\d{3,4}[-\s]\d{4}/;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const ONLY_SYMBOLS = /^[\s⇨⇩↓→←⇒※▶▷◆◇■□○◦●·•\-–—_=*#<>\[\]()]*$/;

// 담당 부서·담당자·연락처가 적힌 끝부분과 연락처 줄을 지운다 (개인정보).
function cleanLines(lines) {
  const contactStart = lines.findIndex((line) => /^[<\[\s]*(담당\s*부서|책임자|담당자)\b/.test(line));
  const body = contactStart >= 0 ? lines.slice(0, contactStart) : lines;
  return body.filter((line) => !PHONE.test(line) && !EMAIL.test(line)).filter((line) => line === "" || !ONLY_SYMBOLS.test(line));
}

// 소제목 줄: [ 추진배경 ], Ⅰ. 개요, 붙임·참고
function headingOf(line) {
  if (line.length > 60) return null;
  const bracket = line.match(/^\[\s*([^\]]{1,40}?)\s*\]$/);
  if (bracket) return bracket[1];
  const roman = line.match(/^([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+)\s*[.\s]\s*(.{1,50})$/);
  if (roman) return `${roman[1]}. ${roman[2]}`;
  if (/^[<\[\s]*(붙임|참고)\s*\d*/.test(line)) return line.replace(/^[<\[\s]+|[>\]\s]+$/g, "");
  return null;
}

// 문단을 모아 한 항목의 길이(약 500자, 최대 900자) 안으로 나눈다.
function packParagraphs(paragraphs) {
  const parts = [];
  let buffer = "";
  for (const paragraph of paragraphs) {
    if (buffer && buffer.length + paragraph.length > MAX_SECTION_CHARS) {
      parts.push(buffer);
      buffer = "";
    }
    buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (buffer.length >= TARGET_SECTION_CHARS) {
      parts.push(buffer);
      buffer = "";
    }
  }
  if (buffer) parts.push(buffer);
  // 너무 짧은 꼬리는 앞 조각에 붙인다.
  if (parts.length > 1 && parts.at(-1).length < MIN_SECTION_CHARS * 2) {
    const tail = parts.pop();
    parts[parts.length - 1] += `\n\n${tail}`;
  }
  return parts;
}

function shortTitle(title, max = 40) {
  const clean = title
    .replace(/\s+/g, " ")
    .replace(/^\[(보도자료|보도참고|보도설명자료)\]\s*/, "")
    .replace(/^[-\s]+|[-\s]+$/g, "");
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

// 항목 제목에 붙이는 첫 문장 조각. 같은 소제목이 여러 조각으로 나뉠 때 조각마다 다른 제목이 되게 한다.
function snippetOf(text) {
  const firstLine = text.split("\n")[0].replace(/^[\s✓□○◦●·•\-–※*➊-➓①-⑳▲▶▷]+/, "");
  return firstLine.length > 60 ? `${firstLine.slice(0, 59)}…` : firstLine;
}

function buildMarkdown(post) {
  const lines = cleanLines(post.lines);
  // 소제목으로 큰 덩어리를 나눈다. 소제목 앞의 글은 "요약"이다.
  const sections = [{ heading: "요약", paragraphs: [] }];
  let paragraph = [];
  const flush = () => {
    if (paragraph.length > 0) sections.at(-1).paragraphs.push(paragraph.join("\n"));
    paragraph = [];
  };
  for (const line of lines) {
    if (line === "") {
      flush();
      continue;
    }
    const heading = headingOf(line);
    if (heading) {
      flush();
      sections.push({ heading, paragraphs: [] });
    } else {
      paragraph.push(line);
    }
  }
  flush();

  const label = shortTitle(post.title);
  const itemLabel = shortTitle(post.title, 26);
  const items = [];
  for (const section of sections) {
    const parts = packParagraphs(section.paragraphs);
    parts.forEach((text) => {
      if (text.length < MIN_SECTION_CHARS) return;
      // 항목 제목: 보도자료 제목(짧게) · 소제목: 첫 문장 조각. 근거 목록과 검색이 제목을 함께 쓴다.
      const snippet = parts.length > 1 || section.heading === "요약" ? `: ${snippetOf(text)}` : "";
      items.push(`## ${itemLabel} · ${section.heading}${snippet}\n\n${text}`);
    });
  }
  if (items.length === 0) return null;

  const front = `---\nsource: 금융위원회 보도자료 「${label}」\nurl: ${BASE}/no010101/${post.id}\nbaseDate: ${post.date}\n---\n`;
  return { markdown: `${front}\n${items.join("\n\n")}\n`, itemCount: items.length };
}

// ---------- 실행 ----------
await mkdir(DRAFT_DIR, { recursive: true });
const existing = [...(await readdir(RAW_DIR)), ...(await readdir(DRAFT_DIR))].filter((name) => /^fsc-\d{4}-\d{2}-\d{2}-(\d+)\.md$/.test(name));
const haveIds = new Set(existing.map((name) => name.match(/-(\d+)\.md$/)[1]));

console.log(`금융위원회 보도자료 게시판에서 "${KEYWORD}" 글을 찾는 중…`);
const posts = await listPosts();
const fresh = posts.filter((post) => !haveIds.has(post.id));
console.log(`찾은 글 ${posts.length}건 중 이미 있는 글 ${posts.length - fresh.length}건, 새 글 ${fresh.length}건`);

if (dryRun) {
  for (const post of fresh) console.log(`  [${post.id}] ${shortTitle(post.title)}`);
  console.log("--dry-run이라 파일을 만들지 않았습니다.");
  process.exit(0);
}

let created = 0;
let failed = 0;
for (const { id } of fresh.slice(0, limit)) {
  try {
    await sleep(REQUEST_GAP_MS);
    const post = await readPost(id);
    const result = buildMarkdown(post);
    if (!result) {
      console.warn(`⚠ [${id}] 옮길 본문이 없어 건너뜁니다 (첨부 파일에만 내용이 있는 글일 수 있습니다): ${shortTitle(post.title)}`);
      failed++;
      continue;
    }
    const file = path.join(DRAFT_DIR, `fsc-${post.date}-${id}.md`);
    await writeFile(file, result.markdown, "utf8");
    console.log(`✅ ${file} — 항목 ${result.itemCount}개 (${post.date}) ${shortTitle(post.title)}`);
    created++;
  } catch (error) {
    console.error(`❌ [${id}] ${error.message}`);
    failed++;
  }
}

console.log(`\n초안 ${created}건을 만들었습니다${failed ? ` (실패·건너뜀 ${failed}건)` : ""}.`);
if (created > 0) {
  console.log("다음 순서로 진행하세요:");
  console.log("  1) npm run review:drafts            (data/draft의 초안을 자동 검사하고 검토 항목을 보여 줌)");
  console.log("  2) 초안을 열어 본문·소제목을 확인한다 (DESIGN.md 12.6 체크리스트)");
  console.log("  3) npm run review:drafts -- --approve   (검사를 통과한 초안을 data/raw로 옮김)");
  console.log("  4) npm run build:chunks → npm run build:index");
}
if (failed > 0 && created === 0) process.exit(1);
