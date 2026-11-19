import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import CalendarPage from './pages/CalendarPage'
import AttendanceStatsPage from './pages/AttendanceStatsPage'
import MyPage from './pages/MyPage'
import SendNotificationPage from './pages/SendNotificationPage'
import ScheduleManagePage from './pages/ScheduleManagePage'
import AttendanceManagePage from './pages/AttendanceManagePage'
import RsvpManagePage from './pages/RsvpManagePage'
import ManitoPage from './pages/ManitoPage'
import ManitoManagePage from './pages/ManitoManagePage'
import MemberApprovalPage from './pages/MemberApprovalPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>로딩 중...</p>
      </div>
    )
  }

  // 가입 후 매니저 승인 전 — firestore.rules 가 부원 데이터를 막으므로 페이지 대신 안내만 보여준다
  if (currentUser?.role === 'pending') {
    return (
      <div className="loading-screen" style={{ padding: 20, textAlign: 'center' }}>
        <h2>가입 승인 대기 중</h2>
        <p>매니저가 가입을 승인하면 이용할 수 있습니다.</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>승인 여부 다시 확인</button>
        <button className="btn-secondary" onClick={signOut}>로그아웃</button>
      </div>
    )
  }

  return currentUser ? <>{children}</> : <Navigate to="/login" />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>로딩 중...</p>
      </div>
    )
  }

  return currentUser ? <Navigate to="/" /> : <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      {/* 공개 라우트 */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      {/* 보호된 라우트 - Bottom Navigation 포함 */}
      <Route
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/stats" element={<AttendanceStatsPage />} />
        <Route path="/manito" element={<ManitoPage />} />
        <Route path="/mypage" element={<MyPage />} />
      </Route>

      {/* 매니저 전용 라우트 - Bottom Navigation 없음 */}
      <Route
        path="/send-notification"
        element={
          <PrivateRoute>
            <SendNotificationPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/schedule-manage"
        element={
          <PrivateRoute>
            <ScheduleManagePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/attendance-manage"
        element={
          <PrivateRoute>
            <AttendanceManagePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/rsvp-manage"
        element={
          <PrivateRoute>
            <RsvpManagePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/manito-manage"
        element={
          <PrivateRoute>
            <ManitoManagePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/member-approval"
        element={
          <PrivateRoute>
            <MemberApprovalPage />
          </PrivateRoute>
        }
      />

      {/* 기본 리다이렉트 */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
