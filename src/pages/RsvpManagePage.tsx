import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { User, PART_LABELS, AttendanceStatus, ATTENDANCE_STATUS_LABELS, Schedule, SCHEDULE_TYPE_LABELS } from '../types'
import './RsvpManagePage.css'

export default function RsvpManagePage() {
  const { currentUser } = useAuth()
  const [members, setMembers] = useState<User[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [rsvpMap, setRsvpMap] = useState<Record<string, AttendanceStatus>>({})

  // 매니저가 아니면 접근 불가
  if (!currentUser || currentUser.role !== 'manager') {
    return (
      <div className="rsvp-manage-page">
        <div className="access-denied">
          <h2>접근 권한 없음</h2>
          <p>매니저만 RSVP를 확인할 수 있습니다.</p>
          <a href="/" className="btn-primary">홈으로 돌아가기</a>
        </div>
      </div>
    )
  }

  useEffect(() => {
    fetchMembers()
    fetchSchedules()
  }, [])

  useEffect(() => {
    if (selectedSchedule) {
      fetchRsvp(selectedSchedule.id)
    } else {
      setRsvpMap({})
    }
  }, [selectedSchedule])

  const fetchSchedules = async () => {
    const today = new Date().toISOString().split('T')[0]
    const q = query(collection(db, 'schedules'), orderBy('date', 'asc'))
    const snapshot = await getDocs(q)
    const data = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Schedule))
      .filter(s => s.date >= today) // 오늘 이후 일정만
    setSchedules(data)
  }

  const fetchMembers = async () => {
    setLoading(true)
    const q = query(collection(db, 'users'), orderBy('name'))
    const snapshot = await getDocs(q)
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User))
    setMembers(data)
    setLoading(false)
  }

  const fetchRsvp = async (scheduleId: string) => {
    const q = query(
      collection(db, 'rsvps'),
      where('scheduleId', '==', scheduleId)
    )
    const snapshot = await getDocs(q)
    const map: Record<string, AttendanceStatus> = {}
    snapshot.docs.forEach(doc => {
      const data = doc.data()
      map[data.userId] = data.status
    })
    setRsvpMap(map)
  }

  const formatScheduleDate = (date: string) => {
    const d = new Date(date)
    return d.toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    })
  }

  const getStatusIcon = (status: AttendanceStatus | undefined) => {
    switch (status) {
      case 'attending': return '✓'
      case 'late': return '⏰'
      case 'absent': return '✗'
      default: return '—'
    }
  }

  const getStatusClass = (status: AttendanceStatus | undefined) => {
    return status || 'unknown'
  }

  // 응답별 카운트
  const attendingCount = Object.values(rsvpMap).filter(s => s === 'attending').length
  const lateCount = Object.values(rsvpMap).filter(s => s === 'late').length
  const absentCount = Object.values(rsvpMap).filter(s => s === 'absent').length
  const noResponseCount = members.length - Object.keys(rsvpMap).length

  return (
    <div className="rsvp-manage-page">
      <header className="page-header">
        <a href="/" className="back-btn">&larr; 뒤로</a>
        <h1>참석 예정 확인</h1>
      </header>

      <main className="page-content">
        {/* 일정 선택 */}
        <div className="schedule-selector">
          <h2>일정 선택</h2>
          {schedules.length === 0 ? (
            <p className="empty-text">예정된 일정이 없습니다.</p>
          ) : (
            <div className="schedule-list">
              {schedules.map(schedule => (
                <button
                  key={schedule.id}
                  className={`schedule-item ${selectedSchedule?.id === schedule.id ? 'selected' : ''}`}
                  onClick={() => setSelectedSchedule(
                    selectedSchedule?.id === schedule.id ? null : schedule
                  )}
                >
                  <span className={`schedule-type-badge ${schedule.type}`}>
                    {SCHEDULE_TYPE_LABELS[schedule.type]}
                  </span>
                  <div className="schedule-item-info">
                    <span className="schedule-item-title">{schedule.title}</span>
                    <span className="schedule-item-date">{formatScheduleDate(schedule.date)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 선택된 일정이 있을 때만 RSVP 표시 */}
        {selectedSchedule && (
          <>
            <div className="selected-schedule-info">
              <h3>{selectedSchedule.title}</h3>
              <p>{formatScheduleDate(selectedSchedule.date)} {selectedSchedule.startTime} - {selectedSchedule.endTime}</p>
              <p>{selectedSchedule.location}</p>
            </div>

            <div className="rsvp-summary">
              <div className="summary-item attending">
                <span className="summary-count">{attendingCount}</span>
                <span className="summary-label">참석</span>
              </div>
              <div className="summary-item late">
                <span className="summary-count">{lateCount}</span>
                <span className="summary-label">지각</span>
              </div>
              <div className="summary-item absent">
                <span className="summary-count">{absentCount}</span>
                <span className="summary-label">불참</span>
              </div>
              <div className="summary-item unknown">
                <span className="summary-count">{noResponseCount}</span>
                <span className="summary-label">미응답</span>
              </div>
            </div>

            <div className="members-section">
              <h2>부원별 응답 ({members.length}명)</h2>
              {loading ? (
                <p className="loading-text">로딩 중...</p>
              ) : (
                <div className="member-list">
                  {members.map(member => {
                    const status = rsvpMap[member.id]
                    return (
                      <div key={member.id} className={`member-card ${getStatusClass(status)}`}>
                        <div className="member-info">
                          <span className="member-name">{member.name}</span>
                          <span className="member-part">{PART_LABELS[member.part]}</span>
                        </div>
                        <div className={`rsvp-status ${getStatusClass(status)}`}>
                          <span className="status-icon">{getStatusIcon(status)}</span>
                          <span className="status-text">
                            {status ? ATTENDANCE_STATUS_LABELS[status] : '미응답'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {!selectedSchedule && schedules.length > 0 && (
          <div className="select-hint">
            <p>참석 예정을 확인할 일정을 선택하세요</p>
          </div>
        )}
      </main>
    </div>
  )
}
