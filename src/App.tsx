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

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>로딩 중...</p>
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
