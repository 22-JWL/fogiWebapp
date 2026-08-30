// 이미지 자르기 기하 계산 (순수 함수 — UI 없이 검증 가능)
//
// 좌표계: 프레임(잘릴 영역) 중심을 원점으로 하는 화면 픽셀.
// scale=1 은 이미지가 프레임을 딱 덮는 크기(cover)이고, 그보다 작아질 수 없다.

export interface Size { width: number; height: number }
export interface Offset { x: number; y: number }

export interface CropView {
  natural: Size  // 원본 이미지 크기
  frame: Size    // 잘릴 영역 크기 (화면 px)
  scale: number  // 1 = cover
  offset: Offset // 프레임 중심 대비 이미지 중심의 이동량 (화면 px)
}

export const MIN_SCALE = 1
export const MAX_SCALE = 5

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** cover 배율: 이미지 1px이 화면 몇 px이 되는가 (scale=1 기준) */
export function baseScale(natural: Size, frame: Size): number {
  if (natural.width <= 0 || natural.height <= 0) return 1
  return Math.max(frame.width / natural.width, frame.height / natural.height)
}

/** 화면에 그려지는 이미지 크기 */
export function displaySize(view: CropView): Size {
  const s = baseScale(view.natural, view.frame) * view.scale
  return { width: view.natural.width * s, height: view.natural.height * s }
}

/** 프레임에 빈 공간이 생기지 않도록 이동량을 가둔다 */
export function clampOffset(view: CropView): Offset {
  const d = displaySize(view)
  const maxX = Math.max(0, (d.width - view.frame.width) / 2)
  const maxY = Math.max(0, (d.height - view.frame.height) / 2)
  return { x: clamp(view.offset.x, -maxX, maxX), y: clamp(view.offset.y, -maxY, maxY) }
}

export function clampScale(scale: number): number {
  return clamp(scale, MIN_SCALE, MAX_SCALE)
}

/**
 * focal(프레임 중심 기준 화면 좌표)에 있는 이미지 지점을 고정한 채 배율을 바꾼다.
 * 휠·핀치 줌이 손가락/커서 아래를 기준으로 움직이게 한다.
 */
export function zoomAround(view: CropView, nextScale: number, focal: Offset): CropView {
  const scale = clampScale(nextScale)
  const ratio = scale / view.scale
  const next: CropView = {
    ...view,
    scale,
    offset: {
      x: focal.x - (focal.x - view.offset.x) * ratio,
      y: focal.y - (focal.y - view.offset.y) * ratio
    }
  }
  return { ...next, offset: clampOffset(next) }
}

export function panBy(view: CropView, dx: number, dy: number): CropView {
  const next: CropView = { ...view, offset: { x: view.offset.x + dx, y: view.offset.y + dy } }
  return { ...next, offset: clampOffset(next) }
}

export interface CropRect { sx: number; sy: number; sw: number; sh: number }

/** 원본 이미지에서 실제로 잘라낼 영역 (canvas drawImage 인자) */
export function cropRect(view: CropView): CropRect {
  const s = baseScale(view.natural, view.frame) * view.scale
  const d = displaySize(view)
  const offset = clampOffset(view)
  return {
    sx: (d.width / 2 - view.frame.width / 2 - offset.x) / s,
    sy: (d.height / 2 - view.frame.height / 2 - offset.y) / s,
    sw: view.frame.width / s,
    sh: view.frame.height / s
  }
}
