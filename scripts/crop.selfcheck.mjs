// 실행: node --experimental-strip-types scripts/crop.selfcheck.mjs
import assert from 'node:assert/strict'
import {
  baseScale, displaySize, clampOffset, clampScale, zoomAround, panBy, cropRect, MIN_SCALE, MAX_SCALE
} from '../src/cropGeometry.ts'

const FRAME = { width: 350, height: 400 } // 7:8
const view = (natural, scale = 1, offset = { x: 0, y: 0 }) => ({ natural, frame: FRAME, scale, offset })
const near = (a, b, msg, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} != ${b}`)

// cover 배율: 가로가 부족한 이미지는 가로 기준으로 확대된다
near(baseScale({ width: 1000, height: 2000 }, FRAME), 0.35, '세로로 긴 이미지는 가로 맞춤')
near(baseScale({ width: 2000, height: 1000 }, FRAME), 0.4, '가로로 긴 이미지는 세로 맞춤')

// scale=1이면 한 변은 프레임에 정확히 맞고 다른 변은 크거나 같다
for (const nat of [{ width: 1000, height: 2000 }, { width: 2000, height: 1000 }, { width: 700, height: 800 }]) {
  const d = displaySize(view(nat))
  assert.ok(d.width >= FRAME.width - 1e-9 && d.height >= FRAME.height - 1e-9, 'cover가 프레임을 덮어야 함')
  assert.ok(Math.abs(d.width - FRAME.width) < 1e-9 || Math.abs(d.height - FRAME.height) < 1e-9, '한 변은 딱 맞아야 함')
}

// 정확히 같은 비율이면 이동 여지가 없다
assert.deepEqual(clampOffset(view({ width: 700, height: 800 }, 1, { x: 999, y: 999 })), { x: 0, y: 0 })

// 가로로 긴 이미지는 좌우로만 움직인다
const wide = view({ width: 2000, height: 1000 }, 1, { x: 9999, y: 9999 })
const c = clampOffset(wide)
near(c.x, (2000 * 0.4 - 350) / 2, '가로 이동 한계')
near(c.y, 0, '세로는 못 움직임')

// 배율 한계
assert.equal(clampScale(0.2), MIN_SCALE)
assert.equal(clampScale(99), MAX_SCALE)
assert.equal(clampScale(2.5), 2.5)

// 잘라낸 영역은 항상 원본 안에 있고 프레임 비율과 같다 (무작위 조합 전수 확인)
let checked = 0
for (const nat of [{ width: 1000, height: 2000 }, { width: 2000, height: 1000 }, { width: 700, height: 800 },
                   { width: 4032, height: 3024 }, { width: 300, height: 300 }]) {
  for (const scale of [1, 1.3, 2, 3.7, 5]) {
    for (const off of [{ x: 0, y: 0 }, { x: 1e5, y: 1e5 }, { x: -1e5, y: -1e5 }, { x: 137, y: -212 }]) {
      const v = { ...view(nat, scale, off), offset: clampOffset(view(nat, scale, off)) }
      const r = cropRect(v)
      assert.ok(r.sx >= -1e-6, `sx 음수: ${JSON.stringify({ nat, scale, off, r })}`)
      assert.ok(r.sy >= -1e-6, `sy 음수: ${JSON.stringify({ nat, scale, off, r })}`)
      assert.ok(r.sx + r.sw <= nat.width + 1e-6, `가로 초과: ${JSON.stringify({ nat, scale, off, r })}`)
      assert.ok(r.sy + r.sh <= nat.height + 1e-6, `세로 초과: ${JSON.stringify({ nat, scale, off, r })}`)
      near(r.sw / r.sh, FRAME.width / FRAME.height, '잘린 영역 비율이 프레임과 같아야 함', 1e-9)
      checked++
    }
  }
}
assert.equal(checked, 100)

// scale=1, offset=0 이면 중앙 크롭 (기존 background: center/cover 와 동일)
const centerCrop = cropRect(view({ width: 2000, height: 1000 }))
near(centerCrop.sw, 350 / 0.4, '중앙 크롭 폭')
near(centerCrop.sh, 1000, '중앙 크롭 높이 = 원본 높이')
near(centerCrop.sx, (2000 - 350 / 0.4) / 2, '중앙 크롭 x')
near(centerCrop.sy, 0, '중앙 크롭 y')

// 확대해도 초점 아래 이미지 지점은 그대로 있어야 한다
const nat = { width: 2000, height: 1500 }
const start = { ...view(nat, 1.5, { x: 20, y: -10 }) }
const focal = { x: 60, y: 40 }
const imagePointAt = (v, p) => {
  const s = baseScale(v.natural, v.frame) * v.scale
  return { x: (p.x - v.offset.x) / s, y: (p.y - v.offset.y) / s }
}
const before = imagePointAt(start, focal)
const zoomed = zoomAround(start, 2.4, focal)
const after = imagePointAt(zoomed, focal)
near(before.x, after.x, '줌 후 초점 x 유지', 1e-9)
near(before.y, after.y, '줌 후 초점 y 유지', 1e-9)
assert.equal(zoomed.scale, 2.4)

// 한계 밖으로 줌해도 배율은 가둬진다
assert.equal(zoomAround(start, 99, focal).scale, MAX_SCALE)
assert.equal(zoomAround(start, 0.1, focal).scale, MIN_SCALE)

// 이동은 즉시 가둬진다
const panned = panBy(view({ width: 2000, height: 1000 }, 1), 99999, 99999)
near(panned.offset.x, (2000 * 0.4 - 350) / 2, '이동 후 좌우 한계')
near(panned.offset.y, 0, '이동 후 상하 고정')

// 이미지 크기가 0이어도 터지지 않는다
assert.equal(baseScale({ width: 0, height: 0 }, FRAME), 1)
assert.deepEqual(clampOffset(view({ width: 0, height: 0 }, 1, { x: 5, y: 5 })), { x: 0, y: 0 })

console.log('crop selfcheck OK')
