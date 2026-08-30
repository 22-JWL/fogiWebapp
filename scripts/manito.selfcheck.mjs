// 실행: node --experimental-strip-types scripts/manito.selfcheck.mjs
import assert from 'node:assert/strict'
import { drawManito, manitoAssignmentId } from '../src/firebase/manito.ts'

assert.equal(manitoAssignmentId('2026-08', 'uid1'), '2026-08_uid1')
// firestore.rules가 split('_')[1]로 userId를 꺼내므로 '_'는 정확히 하나여야 한다
assert.equal(manitoAssignmentId('2026-08', 'uid1').split('_').length, 2)

for (let n = 2; n <= 30; n++) {
  const ids = Array.from({ length: n }, (_, i) => `u${i}`)
  for (let run = 0; run < 200; run++) {
    const pairs = drawManito(ids)
    assert.equal(Object.keys(pairs).length, n, '모든 참가자가 배정되어야 함')
    assert.deepEqual(new Set(Object.keys(pairs)), new Set(ids))
    assert.deepEqual(new Set(Object.values(pairs)), new Set(ids), '모두 정확히 한 번씩 대상이 되어야 함')
    for (const [giver, target] of Object.entries(pairs)) {
      assert.notEqual(giver, target, '자기 자신 배정 금지')
    }
  }
}

assert.throws(() => drawManito(['u0']), /2명 이상/)
assert.throws(() => drawManito([]), /2명 이상/)
assert.throws(() => drawManito(['u0', 'u0']), /중복/)

// 셔플이 실제로 섞이는지 (같은 결과만 반복하면 실패)
const ids = Array.from({ length: 6 }, (_, i) => `u${i}`)
const seen = new Set(Array.from({ length: 50 }, () => JSON.stringify(drawManito(ids))))
assert.ok(seen.size > 1, '추첨 결과가 매번 동일함')

console.log('manito selfcheck OK')
