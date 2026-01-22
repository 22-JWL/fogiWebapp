import { useState, useEffect } from 'react'
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { Schedule, ScheduleType, SCHEDULE_TYPE_LABELS, User } from '../types'
import './ScheduleManagePage.css'

export default function ScheduleManagePage() {
  const { currentUser } = useAuth()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // 폼 상태
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ScheduleType>('practice')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('19:00')
  const [endTime, setEndTime] = useState('21:00')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [referenceLink, setReferenceLink] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 매니저가 아니면 접근 불가
  if (!currentUser || currentUser.role !== 'manager') {
    return (
      <div className="schedule-manage-page">
        <div className="access-denied">
          <h2>접근 권한 없음</h2>
          <p>매니저만 일정을 관리할 수 있습니다.</p>
          <a href="/" className="btn-primary">홈으로 돌아가기</a>
        </div>
      </div>
    )
  }

  useEffect(() => {
    fetchSchedules()
  }, [])

  const fetchSchedules = async () => {
    setLoading(true)
    const q = query(collection(db, 'schedules'), orderBy('date', 'desc'))
    const snapshot = await getDocs(q)
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule))
    setSchedules(data)
    setLoading(false)
  }

  const resetForm = () => {
    setTitle('')
    setType('practice')
    setDate('')
    setStartTime('19:00')
    setEndTime('21:00')
    setLocation('')
    setDescription('')
    setReferenceLink('')
    setEditingSchedule(null)
    setShowForm(false)
  }

  const openNewForm = (selectedDate: string) => {
    resetForm()
    setDate(selectedDate)
    setShowForm(true)
  }

  const openEditForm = (schedule: Schedule) => {
    setEditingSchedule(schedule)
    setTitle(schedule.title)
    setType(schedule.type)
    setDate(schedule.date)
    setStartTime(schedule.startTime)
    setEndTime(schedule.endTime)
    setLocation(schedule.location)
    setDescription(schedule.description || '')
    setReferenceLink(schedule.referenceLink || '')
    setShowForm(true)
  }

  const sendNotification = async (scheduleTitle: string, isUpdate: boolean) => {
    const usersSnapshot = await getDocs(collection(db, 'users'))
    const tokens: string[] = []

    usersSnapshot.forEach((doc) => {
      const userData = doc.data() as User
      if (userData.fcmToken) {
        tokens.push(userData.fcmToken)
      }
    })

    if (tokens.length === 0) return

    await addDoc(collection(db, 'notifications'), {
      title: isUpdate ? '일정 변경' : '새 일정 등록',
      body: scheduleTitle,
      tokens,
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
      status: 'pending'
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const scheduleData = {
        title,
        type,
        date,
        startTime,
        endTime,
        location,
        description: description || null,
        referenceLink: referenceLink || null,
        createdBy: currentUser.id
      }

      if (editingSchedule) {
        await updateDoc(doc(db, 'schedules', editingSchedule.id), {
          ...scheduleData,
          updatedAt: new Date().toISOString()
        })
        await sendNotification(`${SCHEDULE_TYPE_LABELS[type]}: ${title} (${date})`, true)
      } else {
        await addDoc(collection(db, 'schedules'), {
          ...scheduleData,
          createdAt: new Date().toISOString()
        })
        await sendNotification(`${SCHEDULE_TYPE_LABELS[type]}: ${title} (${date})`, false)
      }

      resetForm()
      fetchSchedules()
    } catch (error) {
      console.error('일정 저장 오류:', error)
      alert('일정 저장 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (schedule: Schedule) => {
    if (!confirm(`"${schedule.title}" 일정을 삭제하시겠습니까?`)) return

    try {
      await deleteDoc(doc(db, 'schedules', schedule.id))
      fetchSchedules()
    } catch (error) {
      console.error('일정 삭제 오류:', error)
      alert('일정 삭제 중 오류가 발생했습니다.')
    }
  }

  // 월 변경
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

  const handleDayClick = (day: number) => {
    const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`
    openNewForm(dateStr)
  }

  return (
    <div className="schedule-manage-page">
      <header className="page-header">
        <a href="/" className="back-btn">&larr; 뒤로</a>
        <h1>일정 관리</h1>
      </header>

      <main className="page-content">
        {!showForm ? (
          <>
            {/* 월 선택 */}
            <div className="month-selector">
              <button onClick={() => changeMonth(-1)} className="month-btn">&lt;</button>
              <span className="month-display">{formatMonthDisplay()}</span>
              <button onClick={() => changeMonth(1)} className="month-btn">&gt;</button>
            </div>

            {/* 캘린더 */}
            <div className="calendar-container">
              <p className="calendar-hint">날짜를 클릭하여 일정 등록</p>
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
                      <div
                        key={idx}
                        className={`calendar-cell ${day ? 'clickable' : 'empty'}`}
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
            </div>

            {/* 범례 */}
            <div className="legend">
              <span className="legend-item"><span className="dot practice"></span> 연습</span>
              <span className="legend-item"><span className="dot performance"></span> 공연</span>
              <span className="legend-item"><span className="dot meeting"></span> 회식</span>
            </div>

            {/* 이번 달 일정 목록 */}
            <div className="schedule-list-section">
              <h2>이번 달 일정</h2>
              {loading ? (
                <p className="loading-text">로딩 중...</p>
              ) : (
                <>
                  {schedules
                    .filter(s => s.date.startsWith(selectedMonth))
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(schedule => (
                      <div key={schedule.id} className="schedule-card">
                        <div className="schedule-header">
                          <span className={`schedule-type ${schedule.type}`}>
                            {SCHEDULE_TYPE_LABELS[schedule.type]}
                          </span>
                          <span className="schedule-date">{schedule.date}</span>
                        </div>
                        <h3 className="schedule-title">{schedule.title}</h3>
                        <p className="schedule-time">
                          {schedule.startTime} - {schedule.endTime}
                        </p>
                        <p className="schedule-location">{schedule.location}</p>
                        {schedule.referenceLink && (
                          <a
                            href={schedule.referenceLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="reference-link-btn"
                            onClick={(e) => e.stopPropagation()}
                          >
                            🔗 링크 열기
                          </a>
                        )}
                        <div className="schedule-actions">
                          <button onClick={() => openEditForm(schedule)} className="btn-edit">
                            수정
                          </button>
                          <button onClick={() => handleDelete(schedule)} className="btn-delete">
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  {schedules.filter(s => s.date.startsWith(selectedMonth)).length === 0 && (
                    <p className="empty-text">이번 달 등록된 일정이 없습니다.</p>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="schedule-form">
            <h2>{editingSchedule ? '일정 수정' : '새 일정 등록'}</h2>
            <p className="selected-date">{date}</p>

            <div className="form-group">
              <label>일정 유형</label>
              <div className="type-options">
                {Object.entries(SCHEDULE_TYPE_LABELS).map(([key, label]) => (
                  <label key={key} className="radio-option">
                    <input
                      type="radio"
                      name="type"
                      value={key}
                      checked={type === key}
                      onChange={() => setType(key as ScheduleType)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="title">제목</label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 정기 연습"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="date">날짜</label>
              <input
                type="date"
                id="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="startTime">시작 시간</label>
                <input
                  type="time"
                  id="startTime"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="endTime">종료 시간</label>
                <input
                  type="time"
                  id="endTime"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="location">장소</label>
              <input
                type="text"
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="예: 음악실 201호"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">메모 (선택)</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="추가 안내사항"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="referenceLink">참고 링크 (선택)</label>
              <input
                type="url"
                id="referenceLink"
                value={referenceLink}
                onChange={(e) => setReferenceLink(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="form-actions">
              <button type="button" onClick={resetForm} className="btn-secondary">
                취소
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? '저장 중...' : editingSchedule ? '수정하기' : '등록하기'}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
