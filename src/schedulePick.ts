import type { Schedule } from './types'

// 캘린더를 열었을 때 자동으로 선택할 날짜를 고른다.
// 생일 일정은 부원 수만큼 자동 생성되어 달력을 채우므로, 공연·연습만 후보로 본다.
const PICKABLE_TYPES = ['performance', 'practice'] as const

// 같은 날 여러 일정이면 공연을 먼저 (숫자가 작을수록 우선)
const TYPE_PRIORITY: Record<string, number> = { performance: 0, practice: 1 }

/**
 * 그 달에 공연·연습이 있으면 가장 가까운 다가오는 일정의 날짜를 돌려준다.
 * 전부 지났으면 그중 가장 최근 것, 아예 없으면 fallback(이번 달이면 오늘, 아니면 1일).
 */
export function pickInitialDate(schedules: Schedule[], month: string, today: string): string {
  const fallback = month === today.slice(0, 7) ? today : `${month}-01`

  const candidates = schedules
    .filter(s => (PICKABLE_TYPES as readonly string[]).includes(s.type))
    .sort((a, b) =>
      a.date.localeCompare(b.date) ||
      (TYPE_PRIORITY[a.type] ?? 9) - (TYPE_PRIORITY[b.type] ?? 9) ||
      (a.startTime ?? '').localeCompare(b.startTime ?? '')
    )

  if (candidates.length === 0) return fallback

  const upcoming = candidates.find(s => s.date >= today)
  return (upcoming ?? candidates[candidates.length - 1]).date
}
