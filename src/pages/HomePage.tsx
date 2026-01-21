import { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { setupForegroundMessageListener } from '../firebase/fcm'
import { Schedule, SCHEDULE_TYPE_LABELS, PART_LABELS } from '../types'
import HeroBanner from '../components/HeroBanner'
import ConcertPoster from '../components/ConcertPoster'
import Footer from '../components/Footer'
import './HomePage.css'

interface ToastMessage {
  title: string
  body: string
}

// interface Notification {
//   id: string
//   title: string
//   body: string
//   createdAt: string
// }

export default function HomePage() {
  const { currentUser } = useAuth()
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [upcomingSchedules, setUpcomingSchedules] = useState<Schedule[]>([])
  // const [recentNotifications, setRecentNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return

    loadDashboardData()

    // 포그라운드 메시지 리스너 설정
    setupForegroundMessageListener((payload) => {
      setToast(payload)
      setTimeout(() => setToast(null), 5000)
      // 새 알림이 오면 데이터 새로고침
      loadDashboardData()
    })
  }, [currentUser])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      // 오늘 이후의 일정 가져오기 (최대 5개)
      const today = new Date().toISOString().split('T')[0]
      const schedulesSnap = await getDocs(
        query(
          collection(db, 'schedules'),
          where('date', '>=', today),
          orderBy('date', 'asc'),
          limit(5)
        )
      )
      const schedules: Schedule[] = []
      schedulesSnap.forEach((doc) => {
        schedules.push({ id: doc.id, ...doc.data() } as Schedule)
      })
      setUpcomingSchedules(schedules)

      // // 최근 공지사항 가져오기 (최대 5개)
      // const notificationsSnap = await getDocs(
      //   query(
      //     collection(db, 'notifications'),
      //     orderBy('createdAt', 'desc'),
      //     limit(5)
      //   )
      // )
      // const notifications: Notification[] = []
      // notificationsSnap.forEach((doc) => {
      //   const data = doc.data()
      //   notifications.push({
      //     id: doc.id,
      //     title: data.title,
      //     body: data.body,
      //     createdAt: data.createdAt
      //   })
      // })
      // setRecentNotifications(notifications)
    } catch (error) {
      console.error('대시보드 데이터 로드 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    const weekday = weekdays[date.getDay()]
    return `${month}/${day} (${weekday})`
  }

  // const formatRelativeTime = (dateStr: string) => {
  //   const date = new Date(dateStr)
  //   const now = new Date()
  //   const diffMs = now.getTime() - date.getTime()
  //   const diffMins = Math.floor(diffMs / 60000)
  //   const diffHours = Math.floor(diffMs / 3600000)
  //   const diffDays = Math.floor(diffMs / 86400000)

  //   if (diffMins < 1) return '방금 전'
  //   if (diffMins < 60) return `${diffMins}분 전`
  //   if (diffHours < 24) return `${diffHours}시간 전`
  //   if (diffDays < 7) return `${diffDays}일 전`
  //   return formatDate(dateStr)
  // }

  if (!currentUser) return null

  return (
    <div className="home-page">
      <header className="header">
        <div className="header-content">
          <h1>BandMate</h1>
          <p className="welcome-text">
            안녕하세요, <strong>{currentUser.name}</strong>님!
          </p>
        </div>
      </header>

      <main className="main-content">
        <HeroBanner />

        {isLoading ? (
          <div className="loading">로딩 중...</div>
        ) : (
          <>
            <ConcertPoster />

            <section className="upcoming-section card">
              <div className="section-header">
                <h2>다가오는 일정</h2>
                <a href="/calendar" className="see-all">전체보기</a>
              </div>
              {upcomingSchedules.length > 0 ? (
                <div className="schedule-list">
                  {upcomingSchedules.map((schedule) => (
                    <div key={schedule.id} className="schedule-item">
                      <div className={`schedule-type ${schedule.type}`}>
                        {SCHEDULE_TYPE_LABELS[schedule.type]}
                      </div>
                      <div className="schedule-info">
                        <span className="schedule-title">{schedule.title}</span>
                        <span className="schedule-meta">
                          {formatDate(schedule.date)} · {schedule.startTime}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-message">예정된 일정이 없습니다</p>
              )}
            </section>

            {/* <section className="notifications-section card">
              <div className="section-header">
                <h2>최근 공지</h2>
              </div>
              {recentNotifications.length > 0 ? (
                <div className="notification-list">
                  {recentNotifications.map((notification) => (
                    <div key={notification.id} className="notification-item">
                      <div className="notification-content">
                        <span className="notification-title">{notification.title}</span>
                        <span className="notification-body">{notification.body}</span>
                      </div>
                      <span className="notification-time">
                        {formatRelativeTime(notification.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-message">공지사항이 없습니다</p>
              )}
            </section> */}

            <section className="quick-info card">
              <div className="info-item">
                <span className="info-label">내 파트</span>
                <span className="info-value">{PART_LABELS[currentUser.part]}</span>
              </div>
              <div className="info-item">
                <span className="info-label">역할</span>
                <span className={`info-value role-badge ${currentUser.role}`}>
                  {currentUser.role === 'manager' ? '매니저' : '멤버'}
                </span>
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />

      {toast && (
        <div className="toast">
          <strong>{toast.title}</strong>
          <p>{toast.body}</p>
        </div>
      )}
    </div>
  )
}
