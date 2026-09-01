import type { ScheduleType } from './types'

export interface SchedulePreset {
  title: string
  startTime: string
  endTime: string
  location: string
}

// 유형을 고르지 않았을 때(또는 기본값이 없는 유형)의 빈 폼
export const BLANK_PRESET: SchedulePreset = {
  title: '',
  startTime: '19:00',
  endTime: '21:00',
  location: ''
}

// 유형별 기본값. 매번 같은 값을 다시 입력하는 수고를 던다.
export const TYPE_PRESETS: Partial<Record<ScheduleType, SchedulePreset>> = {
  practice: {
    title: '정기연습',
    startTime: '16:00', // 오후 4시
    endTime: '19:00',   // 오후 7시
    location: '애플합주실'
  }
}

export const presetFor = (type: ScheduleType): SchedulePreset => TYPE_PRESETS[type] ?? BLANK_PRESET

/**
 * 유형을 바꿀 때 폼 값을 어떻게 바꿀지 계산한다.
 * 이전 유형의 기본값 그대로인 칸만 새 기본값으로 교체하고,
 * 사용자가 직접 고친 칸은 건드리지 않는다.
 */
export function applyTypeChange(
  from: ScheduleType,
  to: ScheduleType,
  current: SchedulePreset
): SchedulePreset {
  const before = presetFor(from)
  const after = presetFor(to)
  const pick = (key: keyof SchedulePreset) =>
    current[key] === before[key] ? after[key] : current[key]

  return {
    title: pick('title'),
    startTime: pick('startTime'),
    endTime: pick('endTime'),
    location: pick('location')
  }
}
