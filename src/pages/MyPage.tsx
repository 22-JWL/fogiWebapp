import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import {
  requestNotificationPermission,
  isDeviceRegistered,
  getPlatformInfo
} from '../firebase/fcm'
import { PART_LABELS } from '../types'
import './MyPage.css'

export default function MyPage() {
  const { currentUser, signOut } = useAuth()
  const [notificationStatus, setNotificationStatus] = useState<'pending' | 'granted' | 'denied'>('pending')
  const [hasToken, setHasToken] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [platformInfo] = useState(() => getPlatformInfo())
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!currentUser) return

    // 알림 권한 상태 확인
    if ('Notification' in window) {
      setNotificationStatus(Notification.permission as 'pending' | 'granted' | 'denied')
    }

    // 이 기기가 알림 수신 기기로 등록돼 있는지 확인
    // (등록이 없다고 자동으로 재등록하지 않는다 — 사용자가 끈 알림이 되살아난다)
    isDeviceRegistered(currentUser.id)
      .then(setHasToken)
      .catch(() => setHasToken(false))

    // 매니저에게는 가입 승인 대기 인원을 보여준다 (조회에 실패해도 페이지는 그대로 동작해야 한다)
    if (currentUser.role === 'manager') {
      getDocs(query(collection(db, 'users'), where('role', '==', 'pending')))
        .then((snapshot) => setPendingCount(snapshot.size))
        .catch((error) => console.error('승인 대기 인원 조회 실패:', error))
    }
  }, [currentUser])

  const handleEnableNotifications = async () => {
    if (!currentUser) return

    setIsRegistering(true)
    setErrorMessage(null)

    try {
      const token = await requestNotificationPermission(currentUser.id)
      if (token) {
        setNotificationStatus('granted')
        setHasToken(true)
      } else {
        setNotificationStatus('denied')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '알림 등록에 실패했습니다.'
      setErrorMessage(message)
    } finally {
      setIsRegistering(false)
    }
  }

  const handleSignOut = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      await signOut()
    }
  }

  if (!currentUser) return null

  const showRegisterButton = notificationStatus === 'granted' && !hasToken

  return (
    <div className="mypage">
      <header className="mypage-header">
        <h1>마이페이지</h1>
      </header>

      <div className="mypage-content">
        <section className="profile-section card">
          <div className="profile-avatar">
            <span>{currentUser.name.charAt(0)}</span>
          </div>
          <div className="profile-info">
            <h2 className="profile-name">{currentUser.name}</h2>
            <div className="profile-details">
              <span className="profile-part">{PART_LABELS[currentUser.part]}</span>
              <span className={`profile-role ${currentUser.role}`}>
                {currentUser.role === 'manager' ? '매니저' : '멤버'}
              </span>
            </div>
          </div>
        </section>

        <section className="settings-section card">
          <h3>알림 설정</h3>

          {/* iOS에서 홈 화면 추가 안내 */}
          {platformInfo.isIOS && !platformInfo.isStandalone && (
            <div className="ios-guide">
              <p><strong>iOS에서 푸시 알림 받기</strong></p>
              <p>Safari 하단의 <span className="icon-share">공유</span> 버튼을 탭한 후</p>
              <p>"<strong>홈 화면에 추가</strong>"를 선택하세요.</p>
            </div>
          )}

          {errorMessage && (
            <div className="error-message">
              <p>{errorMessage}</p>
            </div>
          )}

          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-label">푸시 알림</span>
              <span className="setting-desc">
                {notificationStatus === 'granted' && hasToken
                  ? '알림이 활성화되어 있습니다'
                  : notificationStatus === 'denied'
                    ? '알림이 차단되어 있습니다'
                    : '알림을 활성화하여 공지를 받으세요'}
              </span>
            </div>
            {notificationStatus === 'granted' && hasToken ? (
              <span className="setting-status enabled">ON</span>
            ) : notificationStatus === 'denied' ? (
              <span className="setting-status disabled">OFF</span>
            ) : showRegisterButton ? (
              <button
                onClick={handleEnableNotifications}
                className="btn-small"
                disabled={isRegistering}
              >
                {isRegistering ? '등록 중...' : '재등록'}
              </button>
            ) : platformInfo.isIOS && !platformInfo.isStandalone ? (
              <span className="setting-status disabled">OFF</span>
            ) : (
              <button
                onClick={handleEnableNotifications}
                className="btn-small"
                disabled={isRegistering}
              >
                {isRegistering ? '등록 중...' : '활성화'}
              </button>
            )}
          </div>
        </section>

        {currentUser.role === 'manager' && (
          <section className="manager-section card">
            <h3>매니저 메뉴</h3>
            <a href="/member-approval" className="menu-link">
              <span className="menu-icon">🙋</span>
              <span className="menu-text">가입 승인{pendingCount > 0 && ` (${pendingCount})`}</span>
              <span className="menu-arrow">›</span>
            </a>
            <a href="/send-notification" className="menu-link">
              <span className="menu-icon">📢</span>
              <span className="menu-text">공지사항 발송</span>
              <span className="menu-arrow">›</span>
            </a>
            <a href="/schedule-manage" className="menu-link">
              <span className="menu-icon">📅</span>
              <span className="menu-text">일정 관리</span>
              <span className="menu-arrow">›</span>
            </a>
            <a href="/attendance-manage" className="menu-link">
              <span className="menu-icon">✅</span>
              <span className="menu-text">출석 관리</span>
              <span className="menu-arrow">›</span>
            </a>
            <a href="/rsvp-manage" className="menu-link">
              <span className="menu-icon">📋</span>
              <span className="menu-text">참석 예정 확인</span>
              <span className="menu-arrow">›</span>
            </a>
            <a href="/manito-manage" className="menu-link">
              <span className="menu-icon">🎁</span>
              <span className="menu-text">마니또 관리</span>
              <span className="menu-arrow">›</span>
            </a>
          </section>
        )}

        <section className="account-section card">
          <h3>계정</h3>
          <div className="account-info">
            <span className="account-label">이메일</span>
            <span className="account-value">{currentUser.email}</span>
          </div>
          <button onClick={handleSignOut} className="btn-logout">
            로그아웃
          </button>
        </section>

        <footer className="mypage-footer">
          <p>Dizzying F.O.G.I. v2.1.2</p>
        </footer>
      </div>
    </div>
  )
}
