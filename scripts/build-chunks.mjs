// 공개 자료 원문(data/raw/*.md)을 항목 단위로 나눠 data/chunks.json을 만든다 (PLAN 3번).
// Design Ref: §5.1·§6 — 항목마다 id·자료명·항목 제목·본문·기준일·원문 주소를 붙인다.
// 실행: npm run build:chunks   (다른 폴더 시험: node scripts/build-chunks.mjs <원문 폴더> <출력 파일>)
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const rawDir = process.argv[2] ?? "data/raw";
const outFile = process.argv[3] ?? "data/chunks.json";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const errors = [];

function parseFrontMatter(text, file) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    errors.push(`${file}: 맨 위에 --- 로 감싼 자료 정보가 없습니다.`);
    return null;
  }
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  for (const key of ["source", "url", "baseDate"]) {
    if (!meta[key]) errors.push(`${file}: ${key} 값이 비어 있습니다.`);
  }
  if (meta.baseDate && !DATE.test(meta.baseDate)) {
    errors.push(`${file}: baseDate는 YYYY-MM-DD 형식이어야 합니다 (지금: ${meta.baseDate}).`);
  }
  return { meta, body: text.slice(match[0].length) };
}

function splitItems(body) {
  const items = [];
  let current = null;
  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      current = { item: heading[1].trim(), lines: [] };
      items.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return items.map(({ item, lines }) => ({ item, text: lines.join("\n").trim() }));
}

const files = (await readdir(rawDir))
  .filter((name) => name.endsWith(".md") && name !== "README.md" && !name.startsWith("_"))
  .sort();

const chunks = [];
for (const file of files) {
  // 윈도우 메모장 등이 파일 맨 앞에 붙이는 BOM(보이지 않는 문자)을 지운다.
  const text = (await readFile(path.join(rawDir, file), "utf8")).replace(/^﻿/, "");
  const parsed = parseFrontMatter(text, file);
  if (!parsed) continue;

  const items = splitItems(parsed.body);
  if (items.length === 0) errors.push(`${file}: "## 제목"으로 시작하는 항목이 없습니다.`);

  const prefix = path.basename(file, ".md");
  items.forEach(({ item, text }, index) => {
    if (!text) errors.push(`${file}: "${item}" 항목의 본문이 비어 있습니다.`);
    chunks.push({
      id: `${prefix}-${String(index + 1).padStart(3, "0")}`,
      source: parsed.meta.source,
      item,
      text,
      baseDate: parsed.meta.baseDate,
      url: parsed.meta.url,
    });
  });
}

if (errors.length > 0) {
  console.error("❌ 고칠 곳이 있어 chunks.json을 만들지 않았습니다:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify(chunks, null, 2) + "\n", "utf8");
console.log(`✅ 자료 ${files.length}개에서 항목 ${chunks.length}개를 ${outFile}에 저장했습니다.`);
if (files.length === 0) console.log("ℹ data/raw에 옮긴 자료가 아직 없습니다. README.md의 수집 목록을 참고하세요.");
