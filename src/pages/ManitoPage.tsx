import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { ManitoConfig, ManitoAssignment, User, PART_LABELS } from '../types'
import { MANITO_COLLECTION, manitoAssignmentId } from '../firebase/manito'
import './ManitoPage.css'

const thisMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function ManitoPage() {
  const { currentUser } = useAuth()
  const [selectedMonth, setSelectedMonth] = useState(thisMonth)
  const [config, setConfig] = useState<ManitoConfig | null>(null)
  const [target, setTarget] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      setRevealed(false)
      setOpening(false)
      setTarget(null)
      setConfig(null)

      try {
        const configSnap = await getDoc(doc(db, MANITO_COLLECTION, selectedMonth))
        const configData = configSnap.exists() ? (configSnap.data() as ManitoConfig) : null

        let targetUser: User | null = null
        if (configData?.drawnAt) {
          const assignSnap = await getDoc(
            doc(db, MANITO_COLLECTION, manitoAssignmentId(selectedMonth, currentUser.id))
          )
          if (assignSnap.exists()) {
            const { targetId } = assignSnap.data() as ManitoAssignment
            const userSnap = await getDoc(doc(db, 'users', targetId))
            if (userSnap.exists()) {
              targetUser = { id: targetId, ...userSnap.data() } as User
            }
          }
        }

        if (cancelled) return
        setConfig(configData)
        setTarget(targetUser)
      } catch (e) {
        if (!cancelled) setError('마니또 정보를 불러오지 못했습니다.')
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [currentUser?.id, selectedMonth])

  const changeMonth = (delta: number) => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const newDate = new Date(year, month - 1 + delta, 1)
    setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`)
  }

  const formatMonthDisplay = () => {
    const [year, month] = selectedMonth.split('-')
    return `${year}년 ${parseInt(month)}월`
  }

  const isParticipant = !!currentUser && !!config?.participantIds?.includes(currentUser.id)

  const renderBody = () => {
    if (loading) return <p className="loading-text">로딩 중...</p>
    if (error) return <p className="empty-text">{error}</p>
    if (!config?.drawnAt) return <p className="empty-text">아직 이번 달 마니또 추첨이 진행되지 않았습니다.</p>
    if (!isParticipant) return <p className="empty-text">{formatMonthDisplay()} 마니또 참가자가 아닙니다.</p>
    if (!target) return <p className="empty-text">배정 정보를 찾을 수 없습니다. 매니저에게 문의해 주세요.</p>

    return (
      <div className="manito-card">
        <p className="manito-caption">나의 마니또 대상</p>
        {revealed ? (
          <>
            <p className="manito-name">{target.name}</p>
            <p className="manito-part">{PART_LABELS[target.part]}</p>
            <button className="btn-secondary manito-hide-btn" onClick={() => setRevealed(false)}>
              숨기기
            </button>
          </>
        ) : (
          <>
            <div
              className={`gift ${opening ? 'opening' : ''}`}
              onAnimationEnd={e => {
                if (e.target !== e.currentTarget) return // 자식(뚜껑/상자) 애니메이션은 무시
                setOpening(false)
                setRevealed(true)
              }}
            >
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <g className="gift-base">
                  <rect className="gift-body" x="18" y="44" width="64" height="44" rx="6" />
                  <rect className="gift-ribbon" x="44" y="44" width="12" height="44" />
                </g>
                <g className="gift-lid">
                  <circle className="gift-bow" cx="40" cy="26" r="9" />
                  <circle className="gift-bow" cx="60" cy="26" r="9" />
                  <rect className="gift-top" x="12" y="32" width="76" height="16" rx="5" />
                  <rect className="gift-ribbon" x="44" y="32" width="12" height="16" />
                </g>
              </svg>
            </div>
            <button className="btn-primary" onClick={() => setOpening(true)} disabled={opening}>
              {opening ? '여는 중...' : '확인하기'}
            </button>
            <p className="manito-hint">주변에 다른 사람이 없을 때 확인하세요.</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="manito-page">
      <header className="manito-header">
        <h1>마니또</h1>
      </header>

      <div className="manito-content">
        <div className="month-selector">
          <button onClick={() => changeMonth(-1)} className="month-btn">&lt;</button>
          <span className="month-display">{formatMonthDisplay()}</span>
          <button onClick={() => changeMonth(1)} className="month-btn">&gt;</button>
        </div>

        {renderBody()}

        {config?.drawnAt && isParticipant && (
          <p className="manito-meta">참가자 {config.participantIds.length}명</p>
        )}
      </div>
    </div>
  )
}
