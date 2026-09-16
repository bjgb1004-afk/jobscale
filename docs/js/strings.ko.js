/**
 * 한글 텍스트 전부 여기 한 곳에. 화면 코드(app.js, index.html)는 키만 참조한다.
 * 나중에 다른 언어 추가 시: strings.en.js 등을 같은 키 구조로 만들고
 * i18n.js에서 로드할 파일만 바꾸면 된다. (지금은 ko 하나만 존재 — YAGNI)
 */

// 한글 조사(이/가, 은/는, 과/와) 자동 선택 — 회사명 등 사용자 입력값의 받침 유무에 따라 갈림.
// 한글 전용 문법이라 이 파일에 둔다. app.js는 KO_JOSA가 없으면 조사 없이 표시(다른 언어 대비).
function ko_hasBatchim(word) {
  if (!word) return false;
  var ch = String(word).trim().slice(-1);
  var code = ch.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return false; // 한글 완성형 범위 밖(영문/숫자 등)은 받침 없다고 간주
  return (code - 0xAC00) % 28 !== 0;
}
var KO_JOSA = {
  subject: function (w) { return ko_hasBatchim(w) ? '이' : '가'; }, // 이/가
  topic:   function (w) { return ko_hasBatchim(w) ? '은' : '는'; }, // 은/는
  and:     function (w) { return ko_hasBatchim(w) ? '과' : '와'; }  // 과/와
};

var STRINGS_KO = {
  'app.title': '직비',
  'app.footer.disclaimer': '이 점수는 회사 평가가 아니라 내 기준 적합도입니다.',

  'nav.home': '홈',
  'nav.criteria': '내 기준',
  'nav.compare': '나란히 비교',
  'nav.addJob': '공고 추가',

  'home.question': '어떤 게 제일 중요하세요?',
  'home.myJobs': '내 공고 ({count}개)',
  'home.empty': '등록한 공고가 없습니다. 공고를 추가해보세요.',
  'home.oneJobHint': '비교하려면 공고를 1개 더 등록하세요.',
  'home.allRejected': '조건이 너무 엄격합니다. 필수조건을 완화해보세요.',
  'home.noWeights': '중요도를 최소 1개는 선택해주세요.',
  'home.heroTag': '1위 · 가장 잘 맞음',
  'home.rejectedLabel': '탈락',
  'home.viewSource': '공고 보러가기',
  'job.shareHelp.summary': '공고를 빠르게 옮겨오는 법',
  'job.shareHelp.intro': '채용 앱마다 방식이 달라요. 급여·근무시간까지 자동으로 채우려면 ②번 붙여넣기를 쓰는 게 가장 확실합니다.',
  'job.shareHelp.step1': '① 공유가 되는 앱(알바천국 등): 공고 화면에서 공유 → 목록에서 "직비"를 선택하면 등록 화면이 열려요. 다만 대부분 제목과 링크까지만 들어옵니다.',
  'job.shareHelp.step2': '② 급여·근무시간까지 채우려면: 공고 내용을 복사한 뒤, 아래 "공고 내용 붙여넣기" 칸에 붙여넣고 "이 내용으로 채우기"를 누르세요.',
  'job.shareHelp.step3': '사람인·알바몬처럼 공유 목록에 직비가 아예 안 뜨는 앱도 있어요. 그 앱들은 자체 공유창(카톡·문자 등)만 띄우기 때문이라, ②번 붙여넣기로 등록하면 됩니다.',
  'job.shareHelp.note': '공고 글이 복사가 안 되는 사이트라면, 바로 아래 "공고 복사가 안 될 때" 도움말을 보세요.',
  'home.rejectedReason': '{reason}',

  'template.parenting': '육아 병행형',
  'template.money': '돈 우선형',
  'template.easy': '몸 편한 일형',
  'template.balance': '워라밸형',
  'template.custom': '직접 설정',

  'score.fitLabel': '내 기준 적합도',
  'score.suffix': '점',
  'wage.realLabel': '실질시급',
  'wage.nominalLabel': '명목시급',
  'wage.won': '원',

  'reason.MIN_PAY': '월급 {actual}만원 < 최저 기준 {limit}만원',
  'reason.MAX_END_TIME': '퇴근 {actual} > 내 한계 {limit}',
  'reason.MAX_COMMUTE': '통근 {actual}분 > 내 한계 {limit}분',
  'reason.MAX_DAYS': '주 {actual}일 > 내 한계 {limit}일',

  'criteria.title': '내 기준',
  'criteria.weightHeader': '중요도',
  'criteria.limitHeader': '필수조건 (넘으면 탈락)',
  'criteria.targetHeader': '내 희망 기준값',
  'criteria.save': '저장',

  'weight.pay': '급여',
  'weight.commute': '통근',
  'weight.endTime': '퇴근시각',
  'weight.startTime': '출근시각',
  'weight.days': '근무일수',
  'weight.intensity': '업무강도',
  'weight.stability': '고용안정',

  'limit.minPay': '최저 월급',
  'limit.maxEndTime': '최대 퇴근시각',
  'limit.maxCommute': '최대 통근시간',
  'limit.maxDays': '최대 주 근무일',

  'target.commute': '희망 편도 통근시간',
  'target.endTime': '희망 퇴근시각',
  'target.startTime': '가능한 가장 이른 출근시각',
  'target.days': '희망 주 근무일수',

  'unit.manwon': '만원',
  'unit.won': '원',
  'unit.min': '분',
  'unit.day': '일',
  'unit.hour': '시간',

  'job.formTitle': '공고 등록',
  'job.copyHelp.summary': '공고 복사가 안 될 때',
  'job.copyHelp.intro': '채용 사이트가 드래그·복사를 막아둬도, 화면 자체를 읽어오는 방법이라 상관없이 됩니다.',
  'job.copyHelp.method1Title': '① 서클 투 서치 (갤럭시 최신 기종)',
  'job.copyHelp.step1': '공고 화면을 열어둔 채로, 화면 맨 아래 홈 버튼 바(제스처 바)를 길게 누르세요.',
  'job.copyHelp.step2': '화면이 살짝 어두워지면, 원하는 글자 위를 손가락으로 밑줄 긋듯 드래그하세요.',
  'job.copyHelp.step3': '선택된 글자 위에 뜨는 "복사" 버튼을 누르세요.',
  'job.copyHelp.method2Title': '② 구글 렌즈 (안 되는 기기용)',
  'job.copyHelp.step4': '구글 앱을 열고 검색창의 렌즈(카메라 모양) 아이콘을 누르세요.',
  'job.copyHelp.step5': '"화면 캡처" 또는 방금 찍은 스크린샷을 불러와 열고, 원하는 글자를 선택해 복사하세요.',
  'job.copyHelp.fallback': '복사했으면 바로 아래 "공고 내용 붙여넣기" 칸에 붙여넣으세요. 그래도 안 되면 화면을 보면서 각 항목에 직접 입력하면 됩니다.',
  'job.paste.label': '공고 내용 붙여넣기',
  'job.paste.placeholder': '공고 화면에서 복사한 내용을 여기에 붙여넣으세요. 급여·근무시간·요일을 알아서 채웁니다.',
  'job.paste.apply': '이 내용으로 채우기',
  'job.paste.filled': '{fields} 채웠습니다. 맞는지 확인하고 고쳐주세요.',
  'job.paste.nothing': '알아볼 수 있는 정보가 없습니다. 아래에 직접 입력해주세요.',
  'job.name': '회사명',
  'job.pay': '급여',
  'job.payType.monthly': '월급',
  'job.payType.hourly': '시급',
  'job.start': '출근',
  'job.end': '퇴근',
  'job.days': '주 근무일',
  'job.commute': '편도 통근',
  'job.more': '선택 항목 ▾',
  'job.break': '휴게시간',
  'job.intensity': '업무강도',
  'job.employmentType': '고용형태',
  'job.insurance': '4대보험',
  'job.weekendWork': '주말 근무',
  'job.save': '저장',
  'job.delete': '삭제',
  'job.edit': '수정',
  'job.cancel': '취소',
  'job.validation.required': '필수 입력입니다',
  'job.validation.number': '올바른 숫자를 입력하세요',
  'job.validation.time': '시각 형식이 올바르지 않습니다 (예: 09:00)',
  'job.deleteConfirm': '"{name}" 공고를 삭제할까요?',

  'intensity.very_easy': '매우 편함',
  'intensity.easy': '편함',
  'intensity.normal': '보통',
  'intensity.hard': '힘듦',
  'intensity.very_hard': '매우 힘듦',

  'employment.regular': '정규직',
  'employment.contract': '계약직',
  'employment.daily': '일용·단기',

  'compare.title': '나란히 비교',
  'compare.pay': '월급',
  'compare.realWage': '실질시급',
  'compare.workTime': '근무',
  'compare.commute': '통근',
  'compare.days': '근무일',
  'compare.intensity': '업무강도',
  'compare.weekendWork': '주말 근무',
  'compare.total': '내 기준 적합도',

  'unit.yes': '예',
  'unit.no': '아니오',
  'compare.back': '돌아가기',
  'compare.empty': '비교할 공고가 없습니다.',

  'explain.top2': '{top}{topSubj} {best1}{best1And} {best2}에서 당신 기준에 가장 잘 맞습니다.',
  'explain.top1': '{top}{topSubj} {best1}에서 당신 기준에 가장 잘 맞습니다.',
  'explain.weakerThan': ' 단, {worst}{worstTopic} {compare} 대비 낮습니다.',
  'explain.commuteLoss': '이 공고는 출퇴근에 월 {hours}시간을 씁니다.',
  'explain.realWageNote': '명목시급 {nominal}원 · 실질시급(통근 포함) {real}원',

  'backup.export': '백업 내보내기',
  'backup.import': '백업 가져오기',
  'backup.exportDone': '백업 파일을 저장했습니다.',
  'backup.importDone': '백업을 불러왔습니다.',
  'backup.importError': '백업 파일을 읽을 수 없습니다.',

  'share.link': '결과 링크 공유',
  'share.copied': '링크가 복사되었습니다.',
  'share.viewOnly': '공유받은 결과입니다 (읽기 전용)',
  'share.overwriteConfirm': '지금 수정하면 원래 내 데이터가 이 공유 결과로 덮어써집니다. 계속할까요?',

  'pwa.install': '홈 화면에 추가'
};
