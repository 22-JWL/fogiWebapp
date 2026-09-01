// 실행: node --experimental-strip-types scripts/schedulepick.selfcheck.mjs
import assert from 'node:assert/strict'
import { pickInitialDate } from '../src/schedulePick.ts'

const s = (date, type, startTime = '19:00') => ({ id: date + type, date, type, startTime })
const TODAY = '2026-09-15'
const MONTH = '2026-09'

// 후보가 없으면 기존 동작 유지
assert.equal(pickInitialDate([], MONTH, TODAY), TODAY, '이번 달이면 오늘')
assert.equal(pickInitialDate([], '2026-10', TODAY), '2026-10-01', '다른 달이면 1일')

// 생일·회식만 있으면 후보 아님 (생일은 부원 수만큼 자동 생성된다)
assert.equal(pickInitialDate([s('2026-09-03', 'birthday'), s('2026-09-20', 'meeting')], MONTH, TODAY), TODAY)

// 다가오는 연습을 고른다
assert.equal(pickInitialDate([s('2026-09-20', 'practice')], MONTH, TODAY), '2026-09-20')

// 오늘 일정이 있으면 오늘
assert.equal(pickInitialDate([s('2026-09-15', 'practice'), s('2026-09-25', 'performance')], MONTH, TODAY), '2026-09-15')

// 가장 가까운 다가오는 것 (지난 것은 건너뛴다)
assert.equal(
  pickInitialDate([s('2026-09-02', 'performance'), s('2026-09-18', 'practice'), s('2026-09-28', 'practice')], MONTH, TODAY),
  '2026-09-18'
)

// 전부 지났으면 가장 최근 것
assert.equal(
  pickInitialDate([s('2026-09-02', 'practice'), s('2026-09-10', 'performance')], MONTH, TODAY),
  '2026-09-10'
)

// 같은 날 연습+공연이면 공연 우선 (날짜는 같지만 정렬 안정성 확인)
const sameDay = [s('2026-09-20', 'practice', '14:00'), s('2026-09-20', 'performance', '19:00')]
assert.equal(pickInitialDate(sameDay, MONTH, TODAY), '2026-09-20')
assert.equal(pickInitialDate([...sameDay].reverse(), MONTH, TODAY), '2026-09-20', '입력 순서와 무관')

// 지난 달을 볼 때도 그 달의 일정을 고른다
assert.equal(pickInitialDate([s('2026-08-05', 'practice')], '2026-08', TODAY), '2026-08-05')

// 다음 달을 볼 때 (전부 미래)
assert.equal(
  pickInitialDate([s('2026-10-04', 'practice'), s('2026-10-25', 'performance')], '2026-10', TODAY),
  '2026-10-04'
)

// 생일·회식이 섞여 있어도 공연·연습만 고른다
assert.equal(
  pickInitialDate(
    [s('2026-09-16', 'birthday'), s('2026-09-17', 'meeting'), s('2026-09-19', 'practice')],
    MONTH, TODAY
  ),
  '2026-09-19'
)

// startTime 이 없어도 터지지 않는다
assert.equal(pickInitialDate([{ id: 'x', date: '2026-09-20', type: 'practice' }], MONTH, TODAY), '2026-09-20')

console.log('schedulePick selfcheck OK')
