import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { Schedule, AttendanceStatus, SCHEDULE_TYPE_LABELS, ATTENDANCE_STATUS_LABELS } from '../types'
import './CalendarPage.css'

export default function CalendarPage() {
  const { currentUser } = useAuth()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [attendances, setAttendances] = useState<Record<string, AttendanceStatus>>({})
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    if (currentUser) {
      fetchData()
    }
  }, [currentUser, selectedMonth])

  const fetchData = async () => {
    setLoading(true)

    // 일정 조회
    const q = query(collection(db, 'schedules'), orderBy('date', 'asc'))
    const snapshot = await getDocs(q)
    const allSchedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule))

    // 선택된 월의 일정만 필터링
    const filtered = allSchedules.filter(s => s.date.startsWith(selectedMonth))
    setSchedules(filtered)

    // 내 출석 상태 조회
    if (currentUser) {
      const attendanceMap: Record<string, AttendanceStatus> = {}
      for (const schedule of filtered) {
        const attendanceDoc = await getDoc(
          doc(db, 'attendances', `${schedule.id}_${currentUser.id}`)
        )
        if (attendanceDoc.exists()) {
          attendanceMap[schedule.id] = attendanceDoc.data().status
        }
      }
      setAttendances(attendanceMap)
    }

    setLoading(false)
  }

  const handleAttendance = async (scheduleId: string, status: AttendanceStatus) => {
    if (!currentUser) return

    const attendanceId = `${scheduleId}_${currentUser.id}`
    await setDoc(doc(db, 'attendances', attendanceId), {
      scheduleId,
      userId: currentUser.id,
      status,
      updatedAt: new Date().toISOString()
    })

    setAttendances(prev => ({ ...prev, [scheduleId]: status }))
  }

  const changeMonth = (delta: number) => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const newDate = new Date(year, month - 1 + delta, 1)
    setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`)
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

    // 앞쪽 빈 칸
    for (let i = 0; i < startPadding; i++) {
      days.push(null)
    }

    // 실제 날짜
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(i)
    }

    return days
  }

  const getSchedulesForDay = (day: number) => {
    const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`
    return schedules.filter(s => s.date === dateStr)
  }

  if (!currentUser) return null

  return (
    <div className="calendar-page">
      <header className="page-header">
        <a href="/" className="back-btn">&larr; 뒤로</a>
        <h1>일정 / 출석</h1>
      </header>

      <main className="page-content">
        {/* 월 선택 */}
        <div className="month-selector">
          <button onClick={() => changeMonth(-1)} className="month-btn">&lt;</button>
          <span className="month-display">{formatMonthDisplay()}</span>
          <button onClick={() => changeMonth(1)} className="month-btn">&gt;</button>
        </div>

        {/* 간단 캘린더 */}
        <div className="mini-calendar">
          <div className="calendar-header">
            {['일', '월', '화', '수', '목', '금', '토'].map(d => (
              <div key={d} className="calendar-day-name">{d}</div>
            ))}
          </div>
          <div className="calendar-grid">
            {generateCalendarDays().map((day, idx) => {
              const daySchedules = day ? getSchedulesForDay(day) : []
              return (
                <div key={idx} className={`calendar-cell ${day ? '' : 'empty'}`}>
                  {day && (
                    <>
                      <span className="day-number">{day}</span>
                      {daySchedules.length > 0 && (
                        <div className="day-dots">
                          {daySchedules.map(s => (
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
          <span className="legend-item"><span className="dot meeting"></span> 회의</span>
        </div>

        {/* 일정 목록 + 출석 체크 */}
        <div className="schedule-section">
          <h2>이번 달 일정</h2>
          {loading ? (
            <p className="loading-text">로딩 중...</p>
          ) : schedules.length === 0 ? (
            <p className="empty-text">이번 달 일정이 없습니다.</p>
          ) : (
            <div className="schedule-list">
              {schedules.map(schedule => (
                <div key={schedule.id} className="schedule-item">
                  <div className="schedule-info">
                    <div className="schedule-top">
                      <span className={`type-badge ${schedule.type}`}>
                        {SCHEDULE_TYPE_LABELS[schedule.type]}
                      </span>
                      <span className="schedule-date">{schedule.date}</span>
                    </div>
                    <h3>{schedule.title}</h3>
                    <p className="schedule-time">{schedule.startTime} - {schedule.endTime}</p>
                    <p className="schedule-location">{schedule.location}</p>
                  </div>

                  <div className="attendance-section">
                    <span className="attendance-label">출석:</span>
                    <div className="attendance-buttons">
                      {(['attending', 'late', 'absent'] as AttendanceStatus[]).map(status => (
                        <button
                          key={status}
                          className={`attendance-btn ${status} ${attendances[schedule.id] === status ? 'active' : ''}`}
                          onClick={() => handleAttendance(schedule.id, status)}
                        >
                          {ATTENDANCE_STATUS_LABELS[status]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
