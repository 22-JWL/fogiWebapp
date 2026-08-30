import { useEffect, useState } from 'react'
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { Schedule, Attendance, PART_LABELS, User } from '../types'
import {
  BADGES,
  BADGE_GROUP_LABELS,
  BadgeGroup,
  BadgeStats,
  badgeProgress,
  badgeProgressText,
  computeBadgeStats,
  earnedCount
} from '../badges'
import './AttendanceStatsPage.css'

interface UserStats {
  userId: string
  userName: string
  userPart: string
  attending: number
  late: number
  absent: number
  total: number
  rate: number
}

interface MonthlyStats {
  month: string
  attending: number
  late: number
  absent: number
}

export default function AttendanceStatsPage() {
  const { currentUser } = useAuth()
  const [myStats, setMyStats] = useState<UserStats | null>(null)
  const [allStats, setAllStats] = useState<UserStats[]>([])
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([])
  const [badgeStats, setBadgeStats] = useState<BadgeStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'my' | 'all'>('my')

  useEffect(() => {
    if (!currentUser) return
    loadStats()
  }, [currentUser])

  // 전체 통계는 매니저가 실제로 탭을 열었을 때 한 번만 읽는다
  useEffect(() => {
    if (viewMode !== 'all' || currentUser?.role !== 'manager' || allStats.length > 0) return
    loadAllStats()
  }, [viewMode, currentUser])

  const loadStats = async () => {
    if (!currentUser) return
    setIsLoading(true)

    try {
      // 모든 일정 가져오기
      const schedulesSnap = await getDocs(
        query(collection(db, 'schedules'), orderBy('date', 'desc'))
      )
      const schedules: Schedule[] = []
      schedulesSnap.forEach((doc) => {
        schedules.push({ id: doc.id, ...doc.data() } as Schedule)
      })

      // 내 출석 기록만 가져온다 (전체를 읽고 버리면 부원 수 x 일정 수만큼 읽기 비용이 든다)
      const myAttendancesSnap = await getDocs(
        query(collection(db, 'attendances'), where('userId', '==', currentUser.id))
      )
      const myAttendances: Attendance[] = myAttendancesSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Attendance)
      )

      // 내 통계 계산
      const myStatsData: UserStats = {
        userId: currentUser.id,
        userName: currentUser.name,
        userPart: PART_LABELS[currentUser.part],
        attending: myAttendances.filter((a) => a.status === 'attending').length,
        late: myAttendances.filter((a) => a.status === 'late').length,
        absent: myAttendances.filter((a) => a.status === 'absent').length,
        total: myAttendances.length,
        rate: 0
      }
      myStatsData.rate = myStatsData.total > 0
        ? Math.round(((myStatsData.attending + myStatsData.late) / myStatsData.total) * 100)
        : 0
      setMyStats(myStatsData)

      // 배지 계산 — 일정 날짜순 연속 참석이 필요해 일정 시간과 묶는다
      const scheduleKey = new Map(schedules.map((s) => [s.id, `${s.date} ${s.startTime ?? ''}`]))
      // 삭제된 일정의 기록은 날짜를 모르지만 버리면 안 된다 — 버리면 불참이 사라져 참석률이 부풀고
      // 상단 통계와도 어긋난다. 빈 sortKey로 맨 앞에 두고 집계에는 그대로 포함한다.
      const badgeRecords = myAttendances.map((a) => ({
        sortKey: scheduleKey.get(a.scheduleId) ?? '',
        status: a.status
      }))
      setBadgeStats(computeBadgeStats(badgeRecords))

      // 월별 통계 계산 (최근 6개월)
      const monthlyData: { [key: string]: MonthlyStats } = {}
      const now = new Date()
      for (let i = 0; i < 6; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        monthlyData[key] = { month: key, attending: 0, late: 0, absent: 0 }
      }

      myAttendances.forEach((attendance) => {
        const schedule = schedules.find((s) => s.id === attendance.scheduleId)
        if (schedule) {
          const monthKey = schedule.date.substring(0, 7)
          if (monthlyData[monthKey]) {
            if (attendance.status === 'attending') monthlyData[monthKey].attending++
            else if (attendance.status === 'late') monthlyData[monthKey].late++
            else if (attendance.status === 'absent') monthlyData[monthKey].absent++
          }
        }
      })

      setMonthlyStats(Object.values(monthlyData).reverse())

    } catch (error) {
      console.error('통계 로드 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadAllStats = async () => {
    if (!currentUser) return
    try {
      const [usersSnap, attendancesSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'attendances'))
      ])
      const attendances = attendancesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance))

      const allStatsData: UserStats[] = usersSnap.docs.map((d) => {
        const user = { id: d.id, ...d.data() } as User
        const userAttendances = attendances.filter((a) => a.userId === user.id)
        const attending = userAttendances.filter((a) => a.status === 'attending').length
        const late = userAttendances.filter((a) => a.status === 'late').length
        const absent = userAttendances.filter((a) => a.status === 'absent').length
        const total = userAttendances.length
        return {
          userId: user.id,
          userName: user.name,
          userPart: PART_LABELS[user.part],
          attending,
          late,
          absent,
          total,
          rate: total > 0 ? Math.round(((attending + late) / total) * 100) : 0
        }
      })

      allStatsData.sort((a, b) => b.rate - a.rate)
      setAllStats(allStatsData)
    } catch (error) {
      console.error('전체 통계 로드 실패:', error)
    }
  }

  if (!currentUser) return null

  if (isLoading) {
    return (
      <div className="stats-page">
        <header className="stats-header">
          <h1>출석 통계</h1>
        </header>
        <div className="loading">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="stats-page">
      <header className="stats-header">
        <h1>출석 통계</h1>
      </header>

      {currentUser.role === 'manager' && (
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'my' ? 'active' : ''}`}
            onClick={() => setViewMode('my')}
          >
            내 통계
          </button>
          <button
            className={`toggle-btn ${viewMode === 'all' ? 'active' : ''}`}
            onClick={() => setViewMode('all')}
          >
            전체 통계
          </button>
        </div>
      )}

      {viewMode === 'my' && myStats && (
        <div className="stats-content">
          {badgeStats && (
            <section className="badges-section card">
              <div className="badges-head">
                <h2>배지</h2>
                <span className="badges-count">{earnedCount(badgeStats)} / {BADGES.length}</span>
              </div>

              <div className="streak-banner">
                <span className="streak-icon">🔥</span>
                <span className="streak-value">{badgeStats.currentStreak}</span>
                <span className="streak-unit">연속 참석 중</span>
                <span className="streak-best">최고 {badgeStats.bestStreak}연속</span>
              </div>

              {(Object.keys(BADGE_GROUP_LABELS) as BadgeGroup[]).map((group) => (
                <div key={group} className="badge-group">
                  <h3>{BADGE_GROUP_LABELS[group]}</h3>
                  <div className="badge-grid">
                    {BADGES.filter((b) => b.group === group).map((badge) => {
                      const progress = badgeProgress(badge, badgeStats)
                      return (
                        <div
                          key={badge.id}
                          className={`badge ${progress.earned ? 'earned' : 'locked'}`}
                          title={badge.desc}
                        >
                          <span className="badge-icon">{badge.icon}</span>
                          <span className="badge-name">{badge.name}</span>
                          <span className="badge-progress">{badgeProgressText(badge, badgeStats)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              <p className="badges-note">
                배지는 '참석'만 인정 &middot; 참석 {badgeStats.attended}회 / 기록 {badgeStats.total}회
                &middot; 참석률 {badgeStats.rate}%(버림)
              </p>
            </section>
          )}

          <section className="stats-summary card">
            <h2>내 출석 현황</h2>
            <div className="rate-circle">
              <svg viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#333"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="var(--primary-color)"
                  strokeWidth="8"
                  strokeDasharray={`${myStats.rate * 2.83} 283`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="rate-text">
                <span className="rate-number">{myStats.rate}</span>
                <span className="rate-percent">%</span>
              </div>
            </div>
            <p className="rate-label">출석률</p>

            <div className="stats-grid">
              <div className="stat-item attending">
                <span className="stat-value">{myStats.attending}</span>
                <span className="stat-label">참석</span>
              </div>
              <div className="stat-item late">
                <span className="stat-value">{myStats.late}</span>
                <span className="stat-label">지각</span>
              </div>
              <div className="stat-item absent">
                <span className="stat-value">{myStats.absent}</span>
                <span className="stat-label">불참</span>
              </div>
            </div>
          </section>

          <section className="monthly-stats card">
            <h2>월별 출석 현황</h2>
            <div className="monthly-chart">
              {monthlyStats.map((stat) => {
                const total = stat.attending + stat.late + stat.absent
                return (
                  <div key={stat.month} className="month-bar">
                    <div className="bar-container">
                      {total > 0 ? (
                        <>
                          <div
                            className="bar attending"
                            style={{ height: `${(stat.attending / total) * 100}%` }}
                          />
                          <div
                            className="bar late"
                            style={{ height: `${(stat.late / total) * 100}%` }}
                          />
                          <div
                            className="bar absent"
                            style={{ height: `${(stat.absent / total) * 100}%` }}
                          />
                        </>
                      ) : (
                        <div className="bar empty" style={{ height: '100%' }} />
                      )}
                    </div>
                    <span className="month-label">
                      {stat.month.split('-')[1]}월
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="chart-legend">
              <span className="legend-item attending">참석</span>
              <span className="legend-item late">지각</span>
              <span className="legend-item absent">불참</span>
            </div>
          </section>
        </div>
      )}

      {viewMode === 'all' && currentUser.role === 'manager' && (
        <div className="stats-content">
          <section className="all-stats card">
            <h2>전체 멤버 출석 현황</h2>
            <div className="stats-table">
              <div className="table-header">
                <span className="col-name">이름</span>
                <span className="col-part">파트</span>
                <span className="col-stats">참석/지각/불참</span>
                <span className="col-rate">출석률</span>
              </div>
              {allStats.map((stat) => (
                <div key={stat.userId} className="table-row">
                  <span className="col-name">{stat.userName}</span>
                  <span className="col-part">{stat.userPart}</span>
                  <span className="col-stats">
                    <span className="stat-attending">{stat.attending}</span>/
                    <span className="stat-late">{stat.late}</span>/
                    <span className="stat-absent">{stat.absent}</span>
                  </span>
                  <span className="col-rate">
                    <span className={`rate-badge ${stat.rate >= 80 ? 'good' : stat.rate >= 50 ? 'normal' : 'bad'}`}>
                      {stat.rate}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
