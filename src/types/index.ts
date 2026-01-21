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
export type ScheduleType = 'practice' | 'performance' | 'meeting'

export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  practice: '연습',
  performance: '공연',
  meeting: '회의'
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
