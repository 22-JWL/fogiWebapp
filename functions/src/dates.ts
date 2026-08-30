// 시간·입력 검증 순수 함수. firebase 를 import 하지 않아 단독으로 실행 검증할 수 있다.
// 실행: node --experimental-strip-types scripts/birthday.selfcheck.mjs

// 한국 시간 (UTC+9) 가져오기
// UTC 필드에 한국 시각을 심는 방식이라, 이 Date 에는 getUTC* 계열만 써야 한다.
export function getKoreaTime(): Date {
  const now = new Date()
  return new Date(now.getTime() + 9 * 60 * 60 * 1000)
}

// 한국 시간 기준 날짜 문자열 (YYYY-MM-DD)
export function getKoreaDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

// 일정 시작 시간을 UTC timestamp로 변환 (한국 시간 기준 입력)
export function getScheduleTimestamp(dateStr: string, timeStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hours, minutes] = timeStr.split(':').map(Number)
  // 한국 시간 -> UTC (시간이 음수가 되면 Date.UTC 가 알아서 전날로 넘긴다)
  return Date.UTC(year, month - 1, day, hours - 9, minutes, 0)
}

// 가입자가 넣은 값이라 형식을 신뢰할 수 없다.
// 0패딩이 없으면 date 문자열 범위 쿼리가 깨지므로 형식까지 엄격히 본다.
export function isValidBirthday(birthday: unknown): birthday is string {
  if (typeof birthday !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return false
  const [y, m, d] = birthday.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

// 알림·일정 제목에 그대로 들어가므로 줄바꿈 제거 + 길이 제한
export function sanitizeName(name: unknown): string {
  const trimmed = String(name ?? '').replace(/\s+/g, ' ').trim()
  return trimmed.slice(0, 20) || '이름없음'
}

// 다음(또는 오늘) 생일 날짜. 이미 지났으면 내년으로 넘긴다.
// 무조건 올해를 붙이면, 생일이 지난 뒤 가입한 멤버는 과거 날짜 일정을 받아 2년 가까이 캘린더에서 사라진다.
export function getNextBirthday(birthday: string, todayOverride?: string): string {
  const today = todayOverride ?? getKoreaDateString(getKoreaTime())
  const year = Number(today.slice(0, 4))
  const [, month, day] = birthday.split('-')

  const at = (y: number) => {
    // 2월 29일생은 평년에 28일로 당긴다 (존재하지 않는 날짜면 영영 매칭되지 않는다)
    const lastDay = new Date(Date.UTC(y, Number(month), 0)).getUTCDate()
    return `${y}-${month}-${String(Math.min(Number(day), lastDay)).padStart(2, '0')}`
  }

  const thisYear = at(year)
  return thisYear >= today ? thisYear : at(year + 1)
}
