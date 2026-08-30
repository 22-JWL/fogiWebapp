import type { AttendanceStatus } from './types'

// 배지는 '참석'만 인정한다. 지각·불참은 연속을 끊고 누적/참석률에도 들어가지 않는다.
export interface Badge {
  id: string
  group: BadgeGroup
  name: string
  icon: string
  desc: string
  goal: number
}

export type BadgeGroup = 'streak' | 'total' | 'rate'

export const BADGE_GROUP_LABELS: Record<BadgeGroup, string> = {
  streak: '연속 참석',
  total: '누적 참석',
  rate: '참석률'
}

// 참석률 배지는 표본이 너무 적으면 의미가 없어 기록 10회부터 열린다
export const RATE_MIN_TOTAL = 10

export const BADGES: Badge[] = [
  { id: 'streak-3', group: 'streak', name: '불씨', icon: '🔥', desc: '3회 연속 참석', goal: 3 },
  { id: 'streak-5', group: 'streak', name: '열정', icon: '💥', desc: '5회 연속 참석', goal: 5 },
  { id: 'streak-10', group: 'streak', name: '불꽃', icon: '☄️', desc: '10회 연속 참석', goal: 10 },
  { id: 'streak-20', group: 'streak', name: '화신', icon: '🌋', desc: '20회 연속 참석', goal: 20 },

  { id: 'total-1', group: 'total', name: '첫걸음', icon: '👣', desc: '첫 참석', goal: 1 },
  { id: 'total-10', group: 'total', name: '단골', icon: '🎸', desc: '누적 10회 참석', goal: 10 },
  { id: 'total-30', group: 'total', name: '기둥', icon: '🏛️', desc: '누적 30회 참석', goal: 30 },
  { id: 'total-50', group: 'total', name: '전설', icon: '👑', desc: '누적 50회 참석', goal: 50 },
  { id: 'total-100', group: 'total', name: '신화', icon: '🏆', desc: '누적 100회 참석', goal: 100 },

  { id: 'rate-80', group: 'rate', name: '성실', icon: '🌱', desc: '참석률 80% 이상', goal: 80 },
  { id: 'rate-90', group: 'rate', name: '철벽', icon: '🛡️', desc: '참석률 90% 이상', goal: 90 },
  { id: 'rate-100', group: 'rate', name: '무결점', icon: '💯', desc: '참석률 100%', goal: 100 }
]

export interface BadgeStats {
  currentStreak: number
  bestStreak: number
  attended: number // 참석 횟수
  total: number    // 출석 기록 수 (참석+지각+불참)
  rate: number     // 참석 / 전체 (%)
}

export interface BadgeProgress {
  value: number
  earned: boolean
  locked: boolean // 아직 도전 조건을 못 채움 (참석률 배지 전용)
}

/** 일정 날짜순으로 정렬해 연속 참석을 센다. sortKey는 같은 날 여러 일정을 구분하기 위한 값. */
export function computeBadgeStats(records: { sortKey: string; status: AttendanceStatus }[]): BadgeStats {
  const sorted = [...records].sort((a, b) => a.sortKey.localeCompare(b.sortKey))

  let currentStreak = 0
  let bestStreak = 0
  let attended = 0

  for (const r of sorted) {
    if (r.status === 'attending') {
      attended++
      currentStreak++
      if (currentStreak > bestStreak) bestStreak = currentStreak
    } else {
      currentStreak = 0
    }
  }

  const total = sorted.length
  return {
    currentStreak,
    bestStreak,
    attended,
    total,
    // 반올림하면 89.7%가 90%가 되어 '90% 이상' 배지가 기준 미달에 나간다. 내림해야 표기와 판정이 둘 다 정직해진다.
    rate: total > 0 ? Math.floor((attended / total) * 100) : 0
  }
}

export function badgeProgress(badge: Badge, s: BadgeStats): BadgeProgress {
  if (badge.group === 'streak') {
    // 한 번 달성하면 유지되도록 최고 기록으로 판정한다
    return { value: s.bestStreak, earned: s.bestStreak >= badge.goal, locked: false }
  }
  if (badge.group === 'total') {
    return { value: s.attended, earned: s.attended >= badge.goal, locked: false }
  }
  const locked = s.total < RATE_MIN_TOTAL
  return { value: s.rate, earned: !locked && s.rate >= badge.goal, locked }
}

export function badgeProgressText(badge: Badge, s: BadgeStats): string {
  const p = badgeProgress(badge, s)
  if (p.earned) return '획득'
  if (p.locked) return `${RATE_MIN_TOTAL}회 기록 필요`
  return badge.group === 'rate' ? `${p.value}% / ${badge.goal}%` : `${p.value} / ${badge.goal}`
}

export function earnedCount(s: BadgeStats): number {
  return BADGES.filter(b => badgeProgress(b, s).earned).length
}
