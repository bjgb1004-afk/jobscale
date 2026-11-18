/**
 * 공공데이터포털 - 행정안전부 한국지역정보개발원_채용정보 조회 서비스에서
 * 지방공기업·지방출자출연기관 채용공고를 받아 docs/data/jobs.json으로 저장한다.
 *
 * 설치할 패키지 0개 (Node 기본 fetch + 정규식 파싱).
 * 응답 XML은 항목 구조가 평평하고 중첩/속성/CDATA가 없어 정규식으로 충분하다.
 *
 * 로컬 실행:  node scripts/fetchJobs.mjs          (key.txt에서 키를 읽음)
 * CI 실행:    DATA_GO_KR_KEY=... node scripts/fetchJobs.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'data', 'jobs.json');
const ENDPOINT = 'https://apis.data.go.kr/B551982/openApiEmployInfo/openXmlEmployInfo';
const SOURCE = '행정안전부 한국지역정보개발원_채용정보 조회 서비스 (공공데이터포털)';

// 시도 코드는 하드코딩하지 않고 훑는다 — 행정구역 개편이 또 있어도 안 깨진다.
const SIDO_CODES = Array.from({ length: 20 }, (_, i) => `0070${String(i + 1).padStart(2, '0')}`);

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

export function decodeEntities(s) {
  return s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ENTITIES[e]);
}

/** <item> 블록을 쪼개 태그 → 값 객체로 만든다. 'null'/'-'/빈값은 빈 문자열로 통일. */
export function parseItems(xml) {
  const items = [];
  for (const [, block] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const raw = {};
    for (const [, tag, val] of block.matchAll(/<([A-Z_0-9]+)>([\s\S]*?)<\/\1>/g)) {
      const v = decodeEntities(val).trim();
      raw[tag] = v === 'null' || v === '-' ? '' : v;
    }
    items.push(raw);
  }
  return items;
}

/** YEARINCOME은 금액이 아니라 구간 문자열이다: '2600만원 이상', '1억원 이상', '무급' 등. */
export function parseIncome(text) {
  const s = (text || '').trim();
  if (!s) return { incomeWon: null, incomeBound: 'none' };
  if (s.includes('무급')) return { incomeWon: 0, incomeBound: 'none' };

  const eok = s.match(/([\d.]+)\s*억/);
  const man = s.match(/([\d.]+)\s*만원/);
  let won = null;
  if (eok) won = Math.round(parseFloat(eok[1]) * 100000000);
  else if (man) won = Math.round(parseFloat(man[1]) * 10000);
  if (won === null || !isFinite(won)) return { incomeWon: null, incomeBound: 'none' };

  const bound = s.includes('이하') ? 'max' : s.includes('이상') ? 'min' : 'none';
  return { incomeWon: won, incomeBound: bound };
}

/** 앱의 EMPLOYMENT_TYPES(regular/contract/daily)에 맞춘다. 모르는 값은 contract. */
export function mapEmploymentType(jobType) {
  return /정규직|무기계약/.test(jobType || '') ? 'regular' : 'contract';
}

export function isOpen(raw, today) {
  if (raw.STATUS !== '모집중') return false;
  if (!raw.PUB_END_DATE) return false;
  return raw.PUB_END_DATE >= today;
}

export function toItem(raw, sidoCd) {
  const { incomeWon, incomeBound } = parseIncome(raw.YEARINCOME);
  return {
    id: raw.NO,
    sido: sidoCd,
    org: raw.ENT_NAME,
    title: raw.ENT_TITLE,
    field: raw.ENT_RECRUIT,
    jobType: raw.JOB_TYPE,
    emp: mapEmploymentType(raw.JOB_TYPE),
    income: raw.YEARINCOME,
    incomeWon,
    incomeBound,
    end: raw.PUB_END_DATE,
    addr: raw.ADDRESS,
    url: raw.URL,
  };
}

/** 한국 기준 오늘(YYYY-MM-DD). CI는 UTC로 도니까 날짜를 직접 보정한다. */
export function todayKST(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function loadKeys() {
  if (process.env.DATA_GO_KR_KEY) return [process.env.DATA_GO_KR_KEY.trim()];
  // 로컬 편의: key.txt에 인코딩/디코딩 키가 섞여 있어 되는 쪽을 쓴다.
  return readFileSync(join(ROOT, 'key.txt'), 'utf8').trim().split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

async function fetchSido(key, sidoCd) {
  const url = `${ENDPOINT}?serviceKey=${encodeURIComponent(key)}&type=xml&sidoCd=${sidoCd}`;
  const res = await fetch(url);
  const xml = await res.text();
  if (!res.ok || !xml.includes('<resultCode>0</resultCode>')) return null;
  return xml;
}

async function main() {
  const keys = loadKeys();
  const today = todayKST();
  let key = null;
  let firstXml = null;

  for (const k of keys) {
    firstXml = await fetchSido(k, SIDO_CODES[0]);
    if (firstXml) { key = k; break; }
  }
  if (!key) throw new Error('유효한 인증키로 응답을 받지 못했습니다 (DATA_GO_KR_KEY 확인)');

  const regions = {};
  const items = [];
  for (const [i, sidoCd] of SIDO_CODES.entries()) {
    const xml = i === 0 ? firstXml : await fetchSido(key, sidoCd);
    if (!xml) continue; // 응답 없는 코드(폐지·미사용)는 건너뛴다
    const raws = parseItems(xml);
    if (!raws.length) continue;
    regions[sidoCd] = raws[0].SIDO_CD || sidoCd;
    for (const raw of raws) {
      if (isOpen(raw, today)) items.push(toItem(raw, sidoCd));
    }
  }

  // API가 죽거나 응답이 비면 기존 파일을 덮어쓰지 않는다 — 어제 데이터가 빈 목록보다 낫다.
  if (!items.length) throw new Error('모집중 공고가 0건입니다 — 기존 파일을 유지하고 실패로 끝냅니다');

  items.sort((a, b) => a.end.localeCompare(b.end));
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ updated: today, source: SOURCE, regions, items }, null, 0) + '\n');
  console.log(`${items.length}건 저장 (지역 ${Object.keys(regions).length}개) → docs/data/jobs.json`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
