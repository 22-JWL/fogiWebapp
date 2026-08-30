// 실행: node --experimental-strip-types scripts/badges.selfcheck.mjs
import assert from 'node:assert/strict'
import { computeBadgeStats, badgeProgress, badgeProgressText, earnedCount, BADGES, RATE_MIN_TOTAL } from '../src/badges.ts'

const rec = (sortKey, status) => ({ sortKey, status })
const A = 'attending', L = 'late', X = 'absent'

// 빈 기록
assert.deepEqual(computeBadgeStats([]), { currentStreak: 0, bestStreak: 0, attended: 0, total: 0, rate: 0 })

// 지각·불참은 둘 다 연속을 끊는다 (배지는 '참석'만 인정)
let s = computeBadgeStats([rec('1', A), rec('2', A), rec('3', L), rec('4', A)])
assert.equal(s.bestStreak, 2, '지각이 연속을 끊어야 함')
assert.equal(s.currentStreak, 1)
assert.equal(s.attended, 3)
assert.equal(s.total, 4)
assert.equal(s.rate, 75, '지각은 참석률에도 안 들어감')

s = computeBadgeStats([rec('1', A), rec('2', X), rec('3', A), rec('4', A), rec('5', A)])
assert.equal(s.bestStreak, 3)
assert.equal(s.currentStreak, 3)

// 입력 순서가 뒤섞여도 sortKey 기준으로 정렬해서 센다
const shuffled = [rec('2026-03-01', A), rec('2026-01-01', A), rec('2026-02-01', X)]
assert.equal(computeBadgeStats(shuffled).bestStreak, 1)
assert.equal(computeBadgeStats(shuffled).currentStreak, 1)

// 같은 날 여러 일정은 sortKey(날짜+시간)로 구분된다
const sameDay = [rec('2026-01-01 19:00', A), rec('2026-01-01 14:00', X)]
assert.equal(computeBadgeStats(sameDay).currentStreak, 1, '14시 불참 -> 19시 참석')

// 연속 배지는 최고 기록으로 판정 (한 번 따면 유지)
s = computeBadgeStats([...Array(5)].map((_, i) => rec(String(i), A)).concat([rec('9', X)]))
assert.equal(s.currentStreak, 0)
assert.equal(s.bestStreak, 5)
const streak5 = BADGES.find(b => b.id === 'streak-5')
assert.equal(badgeProgress(streak5, s).earned, true, '연속이 끊겨도 획득 배지는 유지')

// 참석률 배지는 기록 10회 미만이면 잠김
s = computeBadgeStats([...Array(9)].map((_, i) => rec(String(i), A)))
const rate100 = BADGES.find(b => b.id === 'rate-100')
assert.equal(badgeProgress(rate100, s).locked, true)
assert.equal(badgeProgress(rate100, s).earned, false)
assert.equal(badgeProgressText(rate100, s), `${RATE_MIN_TOTAL}회 기록 필요`)

s = computeBadgeStats([...Array(10)].map((_, i) => rec(String(i), A)))
assert.equal(badgeProgress(rate100, s).locked, false)
assert.equal(badgeProgress(rate100, s).earned, true)
assert.equal(badgeProgressText(rate100, s), '획득')

// 전원 지각이면 참석률 100%가 나오면 안 된다
s = computeBadgeStats([...Array(10)].map((_, i) => rec(String(i), L)))
assert.equal(s.rate, 0, '지각만으로는 참석률 0')
assert.equal(badgeProgress(rate100, s).earned, false)
assert.equal(earnedCount(s), 0, '지각만 있으면 배지 0개')

// 참석률 경계 — 반올림으로 기준 미달에 배지가 나가면 안 된다
const ratio = (att, tot) => computeBadgeStats([
  ...Array(att).fill(0).map((_, i) => rec('a' + String(i).padStart(4, '0'), A)),
  ...Array(tot - att).fill(0).map((_, i) => rec('z' + String(i).padStart(4, '0'), X))
])
const rate90 = BADGES.find(b => b.id === 'rate-90')
const rate80 = BADGES.find(b => b.id === 'rate-80')

assert.equal(ratio(26, 29).rate, 89, '26/29 = 89.65% -> 89 (반올림하면 90이 되어 오지급)')
assert.equal(badgeProgress(rate90, ratio(26, 29)).earned, false, '89.65%로 90% 배지를 따면 안 됨')
assert.equal(badgeProgress(rate90, ratio(27, 30)).earned, true, '90.0%는 획득')

assert.equal(ratio(35, 44).rate, 79, '35/44 = 79.5% -> 79')
assert.equal(badgeProgress(rate80, ratio(35, 44)).earned, false)
assert.equal(badgeProgress(rate80, ratio(36, 45)).earned, true, '80.0%는 획득')

assert.equal(ratio(199, 200).rate, 99, '199/200 = 99.5% -> 99')
assert.equal(badgeProgress(rate100, ratio(199, 200)).earned, false, '불참 1회가 있으면 무결점 불가')
assert.equal(badgeProgress(rate100, ratio(200, 200)).earned, true, '완전 개근만 무결점')

// 진행도 문구
s = computeBadgeStats([rec('1', A), rec('2', A)])
assert.equal(badgeProgressText(BADGES.find(b => b.id === 'streak-5'), s), '2 / 5')
assert.equal(badgeProgressText(BADGES.find(b => b.id === 'total-10'), s), '2 / 10')
assert.equal(badgeProgressText(BADGES.find(b => b.id === 'total-1'), s), '획득')

// 배지 정의 자체의 무결성
assert.equal(new Set(BADGES.map(b => b.id)).size, BADGES.length, '배지 id 중복')
for (const g of ['streak', 'total', 'rate']) {
  const goals = BADGES.filter(b => b.group === g).map(b => b.goal)
  assert.deepEqual(goals, [...goals].sort((a, b) => a - b), `${g} 배지가 목표치 오름차순이 아님`)
}

// 완벽 출석자는 모든 배지를 딴다
s = computeBadgeStats([...Array(100)].map((_, i) => rec(String(i).padStart(3, '0'), A)))
assert.equal(earnedCount(s), BADGES.length, '100회 개근이면 전체 획득')

console.log('badges selfcheck OK')
