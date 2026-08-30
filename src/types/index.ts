// 사용자 역할
export type UserRole = 'manager' | 'member'

// 파트 종류
export type Part = 'vocal' | 'guitar' | 'bass' | 'drum' | 'keyboard' | 'etc'

export const PART_LABELS: Record<Part, string> = {
  vocal: '보컬',
  guitar: '기타',
  bass: '베이스',
  drum: '드럼',
  keyboard: '키보드',
  etc: '기타(악기 외)'
}

// 사용자 정보
export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  part: Part
  birthday: string // YYYY-MM-DD
  fcmToken?: string
  createdAt: string
}

// 공지사항
export interface Announcement {
  id: string
  title: string
  content: string
  targetParts: Part[] | 'all'
  createdBy: string
  createdAt: string
  sentAt?: string
}

// 알림 페이로드
export interface NotificationPayload {
  title: string
  body: string
  data?: Record<string, string>
}

// 일정 타입
export type ScheduleType = 'practice' | 'performance' | 'meeting' | 'birthday'

export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  practice: '연습',
  performance: '공연',
  meeting: '회식',
  birthday: '생일'
}

// 미리 알림 (분 단위로 저장)
export interface Reminder {
  minutes: number // 분 단위
  label: string   // "30분 전", "2시간 전" 등
}

// 일정
export interface Schedule {
  id: string
  title: string
  type: ScheduleType
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  location: string
  description?: string
  referenceLink?: string // 참고 링크 URL
  reminders?: Reminder[] // 미리 알림 목록 (최대 3개)
  sentReminders?: number[] // 이미 발송된 리마인더 (분 단위 값 목록)
  createdBy: string
  createdAt: string
  updatedAt?: string
}

// 출석 상태
export type AttendanceStatus = 'attending' | 'absent' | 'late'

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  attending: '참석',
  absent: '불참',
  late: '지각'
}

// 출석 기록
export interface Attendance {
  id: string
  scheduleId: string
  userId: string
  status: AttendanceStatus
  note?: string
  updatedAt: string
}

// 마니또 설정 (문서 ID = YYYY-MM)
export interface ManitoConfig {
  month: string // YYYY-MM
  participantIds: string[]
  drawnAt?: string // 추첨 실행 시각 (없으면 아직 추첨 전)
  updatedAt: string
}

// 마니또 배정 (문서 ID = `${month}_${userId}`, 본인과 매니저만 읽기 가능)
export interface ManitoAssignment {
  month: string
  userId: string   // 마니또를 해주는 사람
  targetId: string // 배정된 대상
  createdAt: string
}
