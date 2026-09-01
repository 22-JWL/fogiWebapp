// 실행: node --experimental-strip-types scripts/schedulepresets.selfcheck.mjs
import assert from 'node:assert/strict'
import { presetFor, applyTypeChange, BLANK_PRESET } from '../src/schedulePresets.ts'

const PRACTICE = { title: '정기연습', startTime: '16:00', endTime: '19:00', location: '애플합주실' }

// 연습 기본값
assert.deepEqual(presetFor('practice'), PRACTICE)
// 나머지 유형은 빈 폼
for (const t of ['performance', 'meeting', 'birthday']) {
  assert.deepEqual(presetFor(t), BLANK_PRESET, `${t} 는 기본값 없음`)
}

// 빈 폼에서 연습으로 -> 전부 채워진다
assert.deepEqual(applyTypeChange('performance', 'practice', { ...BLANK_PRESET }), PRACTICE)

// 연습에서 공연으로 -> 연습 기본값이던 칸은 비워진다 (제목에 '정기연습'이 남으면 안 된다)
assert.deepEqual(applyTypeChange('practice', 'performance', { ...PRACTICE }), BLANK_PRESET)

// 사용자가 직접 고친 칸은 유형을 바꿔도 보존된다
const edited = { ...BLANK_PRESET, title: '특별 합주', location: '홍대 스튜디오' }
const r1 = applyTypeChange('performance', 'practice', edited)
assert.equal(r1.title, '특별 합주', '직접 쓴 제목 보존')
assert.equal(r1.location, '홍대 스튜디오', '직접 쓴 장소 보존')
assert.equal(r1.startTime, '16:00', '안 건드린 시간은 연습 기본값으로')
assert.equal(r1.endTime, '19:00')

// 연습 기본값을 일부만 고친 경우 — 고친 칸만 보존
const partial = { ...PRACTICE, title: '번개 연습' }
const r2 = applyTypeChange('practice', 'meeting', partial)
assert.equal(r2.title, '번개 연습', '고친 제목 보존')
assert.equal(r2.location, '', '안 고친 장소는 비워짐')
assert.equal(r2.startTime, '19:00', '안 고친 시간은 빈 폼 기본값으로')

// 같은 유형으로 바꾸면 아무것도 안 변한다
assert.deepEqual(applyTypeChange('practice', 'practice', { ...PRACTICE }), PRACTICE)
assert.deepEqual(applyTypeChange('practice', 'practice', edited), edited)

// 기본값 없는 유형끼리 오가면 값이 유지된다
assert.deepEqual(applyTypeChange('performance', 'meeting', edited), edited)

// 왕복: 연습 -> 공연 -> 연습 이면 다시 연습 기본값
const back = applyTypeChange('performance', 'practice', applyTypeChange('practice', 'performance', { ...PRACTICE }))
assert.deepEqual(back, PRACTICE, '왕복하면 원래 기본값으로 복귀')

console.log('schedulePresets selfcheck OK')
