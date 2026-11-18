/**
 * node scripts/fetchJobs.test.mjs — 네트워크 없이 파싱·변환·필터만 검증한다.
 */
import assert from 'node:assert/strict';
import { decodeEntities, parseItems, parseIncome, mapEmploymentType, isOpen, toItem, todayKST } from './fetchJobs.mjs';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<response><openXmlEmployInfo-body><items>
<item>
<ENT_NAME>창원시설공단</ENT_NAME>
<ENT_TITLE>수영 &amp; 소그룹 강사 공개모집</ENT_TITLE>
<SIDO_CD>경상남도</SIDO_CD>
<STATUS>모집중</STATUS>
<ENT_RECRUIT>이용·숙박·여행·오락·스포츠</ENT_RECRUIT>
<JOB_TYPE>기간제</JOB_TYPE>
<YEARINCOME>2600만원 이상</YEARINCOME>
<OFFICE_HOURS>null</OFFICE_HOURS>
<POSITION>-</POSITION>
<PUB_END_DATE>2026-11-20</PUB_END_DATE>
<ADDRESS>경상남도 창원시 성산구 원이대로 450</ADDRESS>
<URL>https://job.cleaneye.go.kr/user/ypCareersData.do?idx=81013</URL>
<NO>81013</NO>
</item>
<item>
<ENT_NAME>마감기관</ENT_NAME><ENT_TITLE>이미 마감</ENT_TITLE><STATUS>모집중</STATUS>
<JOB_TYPE>일반정규직</JOB_TYPE><YEARINCOME>3000만원 이상</YEARINCOME>
<PUB_END_DATE>2026-01-01</PUB_END_DATE><NO>1</NO>
</item>
<item>
<ENT_NAME>종료기관</ENT_NAME><ENT_TITLE>모집완료 건</ENT_TITLE><STATUS>모집완료</STATUS>
<JOB_TYPE>일반정규직</JOB_TYPE><PUB_END_DATE>2026-12-31</PUB_END_DATE><NO>2</NO>
</item>
</items></openXmlEmployInfo-body></response>`;

const raws = parseItems(XML);
assert.equal(raws.length, 3, 'item 3개를 뽑아야 한다');

// 필드 추출 + 엔티티 디코딩 + 'null'/'-' 정리
assert.equal(raws[0].ENT_NAME, '창원시설공단');
assert.equal(raws[0].ENT_TITLE, '수영 & 소그룹 강사 공개모집');
assert.equal(raws[0].OFFICE_HOURS, '', "'null'은 빈 문자열로");
assert.equal(raws[0].POSITION, '', "'-'도 빈 문자열로");
assert.equal(decodeEntities('a&lt;b&gt;c&quot;d&#39;e&amp;f'), 'a<b>c"d\'e&f');

// 거르기: 마감 지난 건, 모집중 아닌 건
const TODAY = '2026-11-18';
assert.equal(isOpen(raws[0], TODAY), true);
assert.equal(isOpen(raws[1], TODAY), false, '마감일이 오늘 이전이면 제외');
assert.equal(isOpen(raws[2], TODAY), false, '모집중이 아니면 제외');
assert.equal(isOpen({ STATUS: '모집중', PUB_END_DATE: TODAY }, TODAY), true, '마감일이 오늘이면 포함');
assert.equal(isOpen({ STATUS: '모집중', PUB_END_DATE: '' }, TODAY), false, '마감일 없으면 제외');

// 연봉 구간 파싱
assert.deepEqual(parseIncome('2600만원 이상'), { incomeWon: 26000000, incomeBound: 'min' });
assert.deepEqual(parseIncome('1200만원 이하'), { incomeWon: 12000000, incomeBound: 'max' });
assert.deepEqual(parseIncome('1억원 이상'), { incomeWon: 100000000, incomeBound: 'min' });
assert.deepEqual(parseIncome('1.5억원 이상'), { incomeWon: 150000000, incomeBound: 'min' });
assert.deepEqual(parseIncome('무급'), { incomeWon: 0, incomeBound: 'none' });
assert.deepEqual(parseIncome(''), { incomeWon: null, incomeBound: 'none' });
assert.deepEqual(parseIncome('협의 후 결정'), { incomeWon: null, incomeBound: 'none' });

// 고용형태 매핑 — 실측 7종
assert.equal(mapEmploymentType('일반정규직'), 'regular');
assert.equal(mapEmploymentType('무기계약직'), 'regular');
for (const t of ['기간제', '일반계약직', '전문계약직', '인턴', '비상임', '듣보잡']) {
  assert.equal(mapEmploymentType(t), 'contract', `${t} → contract`);
}
assert.equal(mapEmploymentType(''), 'contract');

// 변환 결과
const item = toItem(raws[0], '007015');
assert.deepEqual(item, {
  id: '81013',
  sido: '007015',
  org: '창원시설공단',
  title: '수영 & 소그룹 강사 공개모집',
  field: '이용·숙박·여행·오락·스포츠',
  jobType: '기간제',
  emp: 'contract',
  income: '2600만원 이상',
  incomeWon: 26000000,
  incomeBound: 'min',
  end: '2026-11-20',
  addr: '경상남도 창원시 성산구 원이대로 450',
  url: 'https://job.cleaneye.go.kr/user/ypCareersData.do?idx=81013',
});

// UTC 늦은 시각에도 한국 날짜가 하루 앞으로 가야 한다 (CI는 UTC로 돈다)
assert.equal(todayKST(new Date('2026-11-17T20:00:00Z')), '2026-11-18');
assert.equal(todayKST(new Date('2026-11-17T10:00:00Z')), '2026-11-17');

console.log('fetchJobs 테스트 통과');
