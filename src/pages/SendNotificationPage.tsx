import { useState } from 'react'
import { collection, getDocs, addDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { Part, PART_LABELS, User } from '../types'
import './SendNotificationPage.css'

export default function SendNotificationPage() {
  const { currentUser } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [targetType, setTargetType] = useState<'all' | 'parts'>('all')
  const [selectedParts, setSelectedParts] = useState<Part[]>([])
  const [loading, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  // 매니저가 아니면 접근 불가
  if (!currentUser || currentUser.role !== 'manager') {
    return (
      <div className="send-page">
        <div className="access-denied">
          <h2>접근 권한 없음</h2>
          <p>매니저만 공지사항을 발송할 수 있습니다.</p>
          <a href="/" className="btn-primary">홈으로 돌아가기</a>
        </div>
      </div>
    )
  }

  const handlePartToggle = (part: Part) => {
    setSelectedParts(prev =>
      prev.includes(part)
        ? prev.filter(p => p !== part)
        : [...prev, part]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setResult(null)
    setSending(true)

    try {
      // 모든 사용자 조회 후 클라이언트에서 필터링
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const tokens: string[] = []

      console.log('[발송] 전체 사용자 수:', usersSnapshot.size)

      usersSnapshot.forEach((doc) => {
        const userData = doc.data() as User
        console.log('[발송] 사용자:', userData.name, '파트:', userData.part, 'fcmToken:', userData.fcmToken ? '있음' : '없음')

        // fcmToken이 있는 사용자만 필터링
        if (!userData.fcmToken) return

        // 전체 발송이거나, 선택된 파트에 해당하는 경우
        if (targetType === 'all' || selectedParts.includes(userData.part)) {
          tokens.push(userData.fcmToken)
        }
      })

      console.log('[발송] 발송 대상 토큰 수:', tokens.length)

      if (tokens.length === 0) {
        setResult({
          success: false,
          message: '알림을 받을 대상이 없습니다. (알림 활성화한 멤버가 없음)'
        })
        return
      }

      // Firestore에 알림 기록 저장 (Cloud Functions에서 실제 발송)
      await addDoc(collection(db, 'notifications'), {
        title,
        body: content,
        targetType,
        targetParts: targetType === 'parts' ? selectedParts : null,
        tokens,
        createdBy: currentUser.id,
        createdAt: new Date().toISOString(),
        status: 'pending'
      })

      setResult({
        success: true,
        message: `${tokens.length}명에게 알림 발송을 요청했습니다.`
      })

      // 폼 초기화
      setTitle('')
      setContent('')
      setTargetType('all')
      setSelectedParts([])
    } catch (error) {
      console.error('알림 발송 오류:', error)
      setResult({
        success: false,
        message: '알림 발송 중 오류가 발생했습니다.'
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="send-page">
      <header className="send-header">
        <a href="/" className="back-btn">&larr; 뒤로</a>
        <h1>공지사항 발송</h1>
      </header>

      <main className="send-content">
        <form onSubmit={handleSubmit} className="send-form">
          <div className="form-group">
            <label htmlFor="title">제목</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="알림 제목을 입력하세요"
              required
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label htmlFor="content">내용</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="알림 내용을 입력하세요"
              required
              rows={4}
              maxLength={500}
            />
          </div>

          <div className="form-group">
            <label>발송 대상</label>
            <div className="target-options">
              <label className="radio-option">
                <input
                  type="radio"
                  name="targetType"
                  value="all"
                  checked={targetType === 'all'}
                  onChange={() => setTargetType('all')}
                />
                <span>전체 멤버</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="targetType"
                  value="parts"
                  checked={targetType === 'parts'}
                  onChange={() => setTargetType('parts')}
                />
                <span>특정 파트만</span>
              </label>
            </div>
          </div>

          {targetType === 'parts' && (
            <div className="form-group">
              <label>파트 선택</label>
              <div className="parts-grid">
                {Object.entries(PART_LABELS).map(([key, label]) => (
                  <label key={key} className="checkbox-option">
                    <input
                      type="checkbox"
                      checked={selectedParts.includes(key as Part)}
                      onChange={() => handlePartToggle(key as Part)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div className={`result-message ${result.success ? 'success' : 'error'}`}>
              {result.message}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary send-btn"
            disabled={loading || (targetType === 'parts' && selectedParts.length === 0)}
          >
            {loading ? '발송 중...' : '알림 발송'}
          </button>
        </form>
      </main>
    </div>
  )
}
