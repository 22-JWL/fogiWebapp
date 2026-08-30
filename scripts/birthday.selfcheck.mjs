// 실행: node --experimental-strip-types scripts/birthday.selfcheck.mjs
import assert from 'node:assert/strict'
import {
  getNextBirthday, isValidBirthday, sanitizeName, getScheduleTimestamp, getKoreaDateString
} from '../functions/src/dates.ts'

// --- 생일 날짜 ---
// 아직 안 지났으면 올해
assert.equal(getNextBirthday('1990-12-25', '2026-08-30'), '2026-12-25')
// 오늘이면 오늘 (생일 당일 캘린더에서 사라지면 안 된다)
assert.equal(getNextBirthday('1990-08-30', '2026-08-30'), '2026-08-30')
// 이미 지났으면 내년 (지난 뒤 가입한 멤버가 과거 날짜를 받으면 2년간 안 보인다)
assert.equal(getNextBirthday('1990-01-05', '2026-08-30'), '2027-01-05')
// 연말/연초 경계
assert.equal(getNextBirthday('1990-01-01', '2026-12-31'), '2027-01-01')
assert.equal(getNextBirthday('1990-12-31', '2026-12-31'), '2026-12-31')

// 2월 29일생: 평년이면 28일로 당긴다 (없는 날짜면 영영 매칭 안 됨)
assert.equal(getNextBirthday('1996-02-29', '2026-01-01'), '2026-02-28')
assert.equal(getNextBirthday('1996-02-29', '2028-01-01'), '2028-02-29', '윤년엔 그대로 29일')
assert.equal(getNextBirthday('1996-02-29', '2027-03-01'), '2028-02-29')

// 어떤 날짜를 넣어도 결과는 실재하는 날짜여야 한다
for (const b of ['1990-01-31', '1990-02-29', '1990-03-31', '1990-04-30', '1990-12-31']) {
  for (const today of ['2026-01-01', '2026-06-15', '2027-02-28', '2028-02-29']) {
    const r = getNextBirthday(b, today)
    const [y, m, d] = r.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    assert.equal(dt.getUTCMonth(), m - 1, `실재하지 않는 날짜 생성: ${b} @ ${today} -> ${r}`)
    assert.equal(dt.getUTCDate(), d, `일자 어긋남: ${b} @ ${today} -> ${r}`)
    assert.ok(r >= today, `과거 날짜 생성: ${b} @ ${today} -> ${r}`)
  }
}

// --- 입력 검증 (가입자가 통제하는 값) ---
assert.equal(isValidBirthday('1990-05-15'), true)
assert.equal(isValidBirthday('1996-02-29'), true, '윤년 2/29는 유효')
assert.equal(isValidBirthday('1997-02-29'), false, '평년 2/29는 무효')
assert.equal(isValidBirthday('1990-13-01'), false)
assert.equal(isValidBirthday('1990-5-3'), false, '0패딩 없으면 문자열 범위 쿼리가 깨진다')
assert.equal(isValidBirthday('x'), false)
assert.equal(isValidBirthday(''), false)
assert.equal(isValidBirthday(undefined), false)
assert.equal(isValidBirthday(null), false)
assert.equal(isValidBirthday(12345), false)

// --- 이름 정제 (알림·일정 제목에 그대로 들어간다) ---
assert.equal(sanitizeName('홍길동'), '홍길동')
assert.equal(sanitizeName('  홍길동  '), '홍길동')
assert.equal(sanitizeName('긴급\n연습취소\n링크클릭'), '긴급 연습취소 링크클릭', '줄바꿈으로 알림 위조 방지')
assert.equal(sanitizeName('가'.repeat(100)).length, 20, '길이 제한')
assert.equal(sanitizeName(''), '이름없음')
assert.equal(sanitizeName(undefined), '이름없음')

// --- 일정 시각 -> UTC timestamp (한국시간 해석) ---
// 2026-01-05 19:00 KST = 2026-01-05 10:00 UTC
assert.equal(getScheduleTimestamp('2026-01-05', '19:00'), Date.UTC(2026, 0, 5, 10, 0, 0))
// 자정 근처: 00:30 KST = 전날 15:30 UTC (시간이 음수가 돼도 날짜가 넘어가야 한다)
assert.equal(getScheduleTimestamp('2026-01-05', '00:30'), Date.UTC(2026, 0, 4, 15, 30, 0))
// 연초 경계
assert.equal(getScheduleTimestamp('2026-01-01', '08:00'), Date.UTC(2025, 11, 31, 23, 0, 0))

// --- 한국 날짜 문자열 ---
assert.equal(getKoreaDateString(new Date(Date.UTC(2026, 7, 30, 12, 0))), '2026-08-30')

console.log('birthday selfcheck OK')
