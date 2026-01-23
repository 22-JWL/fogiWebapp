import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, where, doc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { User, PART_LABELS, AttendanceStatus, ATTENDANCE_STATUS_LABELS, Schedule, SCHEDULE_TYPE_LABELS } from '../types'
import './AttendanceManagePage.css'

export default function AttendanceManagePage() {
  const { currentUser } = useAuth()
  const [members, setMembers] = useState<User[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({})
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })

  // 매니저가 아니면 접근 불가
  if (!currentUser || currentUser.role !== 'manager') {
    return (
      <div className="attendance-manage-page">
        <div className="access-denied">
          <h2>접근 권한 없음</h2>
          <p>매니저만 출석을 관리할 수 있습니다.</p>
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
      fetchAttendance(selectedSchedule.id)
    } else {
      setAttendanceMap({})
    }
  }, [selectedSchedule])

  const fetchSchedules = async () => {
    const q = query(collection(db, 'schedules'), orderBy('date', 'desc'))
    const snapshot = await getDocs(q)
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule))
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

  const fetchAttendance = async (scheduleId: string) => {
    const q = query(
      collection(db, 'attendances'),
      where('scheduleId', '==', scheduleId)
    )
    const snapshot = await getDocs(q)
    const map: Record<string, AttendanceStatus> = {}
    snapshot.docs.forEach(doc => {
      const data = doc.data()
      map[data.userId] = data.status
    })
    setAttendanceMap(map)
  }

  const handleAttendanceChange = async (userId: string, status: AttendanceStatus) => {
    if (!selectedSchedule) return

    const docId = `${selectedSchedule.id}_${userId}`
    const currentStatus = attendanceMap[userId]

    // 같은 상태를 다시 클릭하면 출석 취소
    if (currentStatus === status) {
      setAttendanceMap(prev => {
        const newMap = { ...prev }
        delete newMap[userId]
        return newMap
      })
      await deleteDoc(doc(db, 'attendances', docId))
    } else {
      // 새로운 상태로 저장
      setAttendanceMap(prev => ({ ...prev, [userId]: status }))
      await setDoc(doc(db, 'attendances', docId), {
        userId,
        scheduleId: selectedSchedule.id,
        status,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.id
      })
    }
  }

  const formatScheduleDate = (date: string) => {
    const d = new Date(date)
    return d.toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    })
  }

  // 월 변경
  const changeMonth = (delta: number) => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const newDate = new Date(year, month - 1 + delta, 1)
    const newMonth = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(newMonth)
    setSelectedDate(`${newMonth}-01`)
    setSelectedSchedule(null)
  }

  const formatMonthDisplay = () => {
    const [year, month] = selectedMonth.split('-')
    return `${year}년 ${parseInt(month)}월`
  }

  // 캘린더 날짜 생성
  const generateCalendarDays = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const startPadding = firstDay.getDay()
    const days: (number | null)[] = []

    for (let i = 0; i < startPadding; i++) {
      days.push(null)
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(i)
    }

    return days
  }

  const getSchedulesForDay = (day: number) => {
    const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`
    return schedules.filter(s => s.date === dateStr)
  }

  // 날짜 클릭 핸들러
  const handleDayClick = (day: number) => {
    const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`
    setSelectedDate(dateStr)
    setSelectedSchedule(null)
  }

  // 선택된 날짜의 일정 필터링 및 startTime 기준 정렬
  const filteredSchedules = schedules
    .filter(s => s.date === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  // 선택된 날짜 포맷팅 (표시용)
  const formatSelectedDate = () => {
    const [year, month, day] = selectedDate.split('-')
    return `${year}년 ${parseInt(month)}월 ${parseInt(day)}일`
  }

  return (
    <div className="attendance-manage-page">
      <header className="page-header">
        <a href="/" className="back-btn">&larr; 뒤로</a>
        <h1>출석 관리</h1>
      </header>

      <main className="page-content">
        {/* 월 선택 */}
        <div className="month-selector">
          <button onClick={() => changeMonth(-1)} className="month-btn">&lt;</button>
          <span className="month-display">{formatMonthDisplay()}</span>
          <button onClick={() => changeMonth(1)} className="month-btn">&gt;</button>
        </div>

        {/* 캘린더 */}
        <div className="mini-calendar">
          <div className="calendar-header">
            {['일', '월', '화', '수', '목', '금', '토'].map(d => (
              <div key={d} className="calendar-day-name">{d}</div>
            ))}
          </div>
          <div className="calendar-grid">
            {generateCalendarDays().map((day, idx) => {
              const daySchedules = day ? getSchedulesForDay(day) : []
              const dateStr = day ? `${selectedMonth}-${String(day).padStart(2, '0')}` : ''
              const isSelected = dateStr === selectedDate
              return (
                <div
                  key={idx}
                  className={`calendar-cell ${day ? 'clickable' : 'empty'} ${isSelected ? 'selected' : ''}`}
                  onClick={() => day && handleDayClick(day)}
                >
                  {day && (
                    <>
                      <span className="day-number">{day}</span>
                      {daySchedules.length > 0 && (
                        <div className="day-dots">
                          {daySchedules.slice(0, 3).map(s => (
                            <span key={s.id} className={`dot ${s.type}`}></span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 범례 */}
        <div className="legend">
          <span className="legend-item"><span className="dot practice"></span> 연습</span>
          <span className="legend-item"><span className="dot performance"></span> 공연</span>
          <span className="legend-item"><span className="dot meeting"></span> 회식</span>
        </div>

        {/* 일정 선택 */}
        <div className="schedule-selector">
          <h2>{formatSelectedDate()} 일정</h2>
          {filteredSchedules.length === 0 ? (
            <p className="empty-text">등록된 일정이 없습니다.</p>
          ) : (
            <div className="schedule-list">
              {filteredSchedules.map(schedule => (
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
                    <span className="schedule-item-time">{schedule.startTime} - {schedule.endTime}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 선택된 일정이 있을 때만 출석 관리 표시 */}
        {selectedSchedule && (
          <>
            <div className="selected-schedule-info">
              <h3>{selectedSchedule.title}</h3>
              <p>{formatScheduleDate(selectedSchedule.date)} {selectedSchedule.startTime} - {selectedSchedule.endTime}</p>
              <p>{selectedSchedule.location}</p>
            </div>

            <div className="attendance-summary">
              <div className="summary-item attending">
                <span className="summary-count">
                  {Object.values(attendanceMap).filter(s => s === 'attending').length}
                </span>
                <span className="summary-label">출석</span>
              </div>
              <div className="summary-item late">
                <span className="summary-count">
                  {Object.values(attendanceMap).filter(s => s === 'late').length}
                </span>
                <span className="summary-label">지각</span>
              </div>
              <div className="summary-item absent">
                <span className="summary-count">
                  {Object.values(attendanceMap).filter(s => s === 'absent').length}
                </span>
                <span className="summary-label">결석</span>
              </div>
            </div>

            <div className="members-section">
              <h2>부원 목록 ({members.length}명)</h2>
              {loading ? (
                <p className="loading-text">로딩 중...</p>
              ) : (
                <div className="member-list">
                  {members.map(member => (
                    <div key={member.id} className="member-card">
                      <div className="member-info">
                        <span className="member-name">{member.name}</span>
                        <span className="member-part">{PART_LABELS[member.part]}</span>
                      </div>
                      <div className="attendance-buttons">
                        {(['attending', 'late', 'absent'] as AttendanceStatus[]).map(status => (
                          <button
                            key={status}
                            className={`attendance-btn ${status} ${attendanceMap[member.id] === status ? 'active' : ''}`}
                            onClick={() => handleAttendanceChange(member.id, status)}
                          >
                            {ATTENDANCE_STATUS_LABELS[status]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {members.length === 0 && (
                    <p className="empty-text">등록된 부원이 없습니다.</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {!selectedSchedule && filteredSchedules.length > 0 && (
          <div className="select-hint">
            <p>출석을 관리할 일정을 선택하세요</p>
          </div>
        )}
      </main>
    </div>
  )
}
