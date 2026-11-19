import { useState, useEffect } from 'react'
import { collection, getDocs, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { User, PART_LABELS } from '../types'
import './AttendanceManagePage.css' // 레이아웃·부원 카드·버튼 스타일을 그대로 쓴다

// 승인 전 계정이 직접 쓴 문서라 필드 타입을 믿을 수 없다 (문자열이 아닌 값을 그리면 페이지가 죽는다)
const text = (value: unknown) => (typeof value === 'string' ? value : '')

export default function MemberApprovalPage() {
  const { currentUser } = useAuth()
  const isManager = currentUser?.role === 'manager'
  const [pending, setPending] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isManager) return // 가드가 훅 뒤에 있으므로 여기서 막는다
    getDocs(query(collection(db, 'users'), where('role', '==', 'pending')))
      .then(snapshot => {
        setPending(
          snapshot.docs
            // id 를 뒤에 둔다 — 문서 안에 id 필드를 심어 승인·거절 대상을 남의 문서로 바꿔치기할 수 없게
            .map(d => ({ ...d.data(), id: d.id } as User))
            .sort((a, b) => text(a.createdAt).localeCompare(text(b.createdAt)))
        )
      })
      .catch(e => {
        console.error(e)
        setMessage('가입 신청 목록을 불러오지 못했습니다.')
      })
      .finally(() => setLoading(false))
  }, [isManager])

  // 승인 = role 을 member 로, 거절 = users 문서 삭제 (firestore.rules 가 매니저에게만 허용한다)
  const handleDecision = async (user: User, approve: boolean) => {
    if (!approve && !window.confirm(`${text(user.name)} 님의 가입 신청을 거절할까요? 신청 정보가 삭제됩니다.`)) return
    setBusy(true)
    setMessage('')
    try {
      const userRef = doc(db, 'users', user.id)
      await (approve ? updateDoc(userRef, { role: 'member' }) : deleteDoc(userRef))
      setPending(prev => prev.filter(u => u.id !== user.id))
    } catch (e) {
      console.error(e)
      setMessage(approve ? '승인에 실패했습니다. 다시 시도해 주세요.' : '거절에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  // 매니저가 아니면 접근 불가
  if (!isManager) {
    return (
      <div className="attendance-manage-page">
        <div className="access-denied">
          <h2>접근 권한 없음</h2>
          <p>매니저만 가입을 승인할 수 있습니다.</p>
          <a href="/" className="btn-primary">홈으로 돌아가기</a>
        </div>
      </div>
    )
  }

  return (
    <div className="attendance-manage-page">
      <header className="page-header">
        <a href="/" className="back-btn">&larr; 뒤로</a>
        <h1>가입 승인</h1>
      </header>

      <main className="page-content">
        {message && <p className="error-message">{message}</p>}

        <div className="members-section">
          <h2>승인 대기 ({pending.length}명)</h2>
          {loading ? (
            <p className="loading-text">로딩 중...</p>
          ) : pending.length === 0 ? (
            <p className="empty-text">승인을 기다리는 가입 신청이 없습니다.</p>
          ) : (
            <div className="member-list">
              {pending.map(user => (
                <div key={user.id} className="member-card">
                  <div className="member-info" style={{ overflowWrap: 'anywhere' }}>
                    <span className="member-name">{text(user.name)}</span>
                    <span className="member-part">{text(PART_LABELS[user.part])}</span>
                    <span className="member-part">{text(user.email)}</span>
                    <span className="member-part">가입 신청 {new Date(user.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <div className="attendance-buttons">
                    <button className="attendance-btn attending" disabled={busy} onClick={() => handleDecision(user, true)}>
                      승인
                    </button>
                    <button className="attendance-btn absent" disabled={busy} onClick={() => handleDecision(user, false)}>
                      거절
                    </button>
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
