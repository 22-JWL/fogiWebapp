import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy, doc, setDoc, getDoc, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { Schedule, AttendanceStatus, SCHEDULE_TYPE_LABELS, ATTENDANCE_STATUS_LABELS } from '../types'
import './CalendarPage.css'

export default function CalendarPage() {
  const { currentUser } = useAuth()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [attendances, setAttendances] = useState<Record<string, AttendanceStatus>>({})
  const [rsvpStats, setRsvpStats] = useState<Record<string, { attending: number; late: number; total: number }>>({})
  const [totalMembers, setTotalMembers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })

  useEffect(() => {
    if (currentUser) {
      fetchData()
    }
  }, [currentUser, selectedMonth])

  const fetchData = async () => {
    setLoading(true)

    // 전체 인원 수 조회
    const usersSnapshot = await getDocs(collection(db, 'users'))
    setTotalMembers(usersSnapshot.size)

    // 일정 조회
    const q = query(collection(db, 'schedules'), orderBy('date', 'asc'))
    const snapshot = await getDocs(q)
    const allSchedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule))

    // 선택된 월의 일정만 필터링
    const filtered = allSchedules.filter(s => s.date.startsWith(selectedMonth))
    setSchedules(filtered)

    // 내 RSVP 상태 조회 + 일정별 RSVP 통계
    if (currentUser) {
      const attendanceMap: Record<string, AttendanceStatus> = {}
      const statsMap: Record<string, { attending: number; late: number; total: number }> = {}

      for (const schedule of filtered) {
        // 내 RSVP 상태
        const rsvpDoc = await getDoc(
          doc(db, 'rsvps', `${schedule.id}_${currentUser.id}`)
        )
        if (rsvpDoc.exists()) {
          attendanceMap[schedule.id] = rsvpDoc.data().status
        }

        // 일정별 전체 RSVP 통계
        const rsvpQuery = query(
          collection(db, 'rsvps'),
          where('scheduleId', '==', schedule.id)
        )
        const rsvpSnapshot = await getDocs(rsvpQuery)
        let attending = 0
        let late = 0
        rsvpSnapshot.docs.forEach(doc => {
          const status = doc.data().status
          if (status === 'attending') attending++
          else if (status === 'late') late++
        })
        statsMap[schedule.id] = { attending, late, total: usersSnapshot.size }
      }

      setAttendances(attendanceMap)
      setRsvpStats(statsMap)
    }

    setLoading(false)
  }

  const handleRsvp = async (scheduleId: string, status: AttendanceStatus) => {
    if (!currentUser) return

    const rsvpId = `${scheduleId}_${currentUser.id}`
    await setDoc(doc(db, 'rsvps', rsvpId), {
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
    const newMonth = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(newMonth)
    setSelectedDate(`${newMonth}-01`)
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

  // 날짜 클릭 핸들러
  const handleDayClick = (day: number) => {
    const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`
    setSelectedDate(dateStr)
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
          <span className="legend-item"><span className="dot meeting"></span> 회식</span>
        </div>

        {/* 일정 목록 + 출석 체크 */}
        <div className="schedule-section">
          <h2>{formatSelectedDate()} 일정</h2>
          {loading ? (
            <p className="loading-text">로딩 중...</p>
          ) : filteredSchedules.length === 0 ? (
            <p className="empty-text">등록된 일정이 없습니다.</p>
          ) : (
            <div className="schedule-list">
              {filteredSchedules.map(schedule => (
                <div key={schedule.id} className="schedule-item">
                  <div className="schedule-info">
                    <div className="schedule-top">
                      <span className={`type-badge ${schedule.type}`}>
                        {SCHEDULE_TYPE_LABELS[schedule.type]}
                      </span>
                      <span className="schedule-time-badge">{schedule.startTime} - {schedule.endTime}</span>
                    </div>
                    <h3>{schedule.title}</h3>
                    <div className="schedule-meta">
                      <span className="schedule-location">{schedule.location}</span>
                    </div>
                    {schedule.referenceLink && (
                      <a
                        href={schedule.referenceLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="reference-link-btn"
                      >
                        🔗 링크 열기
                      </a>
                    )}
                  </div>

                  <div className="attendance-section">
                    <div className="attendance-row">
                      <span className="attendance-label">참석 예정:</span>
                      <div className="attendance-buttons">
                        {(['attending', 'late', 'absent'] as AttendanceStatus[]).map(status => (
                          <button
                            key={status}
                            className={`attendance-btn ${status} ${attendances[schedule.id] === status ? 'active' : ''}`}
                            onClick={() => handleRsvp(schedule.id, status)}
                          >
                            {ATTENDANCE_STATUS_LABELS[status]}
                          </button>
                        ))}
                      </div>
                    </div>
                    {rsvpStats[schedule.id] && totalMembers > 0 && (
                      <div className="rsvp-rate">
                        <span className="rsvp-rate-text">
                          {rsvpStats[schedule.id].attending + rsvpStats[schedule.id].late}/{totalMembers}명 참석 예정 ({Math.round(((rsvpStats[schedule.id].attending + rsvpStats[schedule.id].late) / totalMembers) * 100)}%)
                        </span>
                      </div>
                    )}
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
