import { useEffect, useState } from 'react'
import { collection, deleteField, doc, getDoc, getDocs, orderBy, query, writeBatch, WriteBatch } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { ManitoConfig, ManitoAssignment, User, PART_LABELS } from '../types'
import { MANITO_COLLECTION, manitoAssignmentId, drawManito } from '../firebase/manito'
import './ManitoManagePage.css'

const thisMonth = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function ManitoManagePage() {
  const { currentUser } = useAuth()
  const isManager = currentUser?.role === 'manager'

  const [selectedMonth, setSelectedMonth] = useState(thisMonth)
  const [members, setMembers] = useState<User[]>([])
  const [participantIds, setParticipantIds] = useState<string[]>([])
  // 서버에 저장된 명단 — 명단이 바뀌었는지 판단해 기존 추첨을 무효화하는 데 쓴다
  const [serverRoster, setServerRoster] = useState<string[]>([])
  const [drawnAt, setDrawnAt] = useState<string | null>(null)
  const [pairs, setPairs] = useState<Record<string, string>>({})
  const [showResult, setShowResult] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isManager) return
    const fetchMembers = async () => {
      const snapshot = await getDocs(query(collection(db, 'users'), orderBy('name')))
      setMembers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User)))
    }
    fetchMembers().catch(e => {
      console.error(e)
      setMessage('부원 목록을 불러오지 못했습니다.')
    })
  }, [isManager])

  useEffect(() => {
    if (!isManager) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setMessage('')
      setShowResult(false)
      // 월이 바뀌면 이전 달 값이 남지 않도록 먼저 비운다 (로딩 실패 시 잔상 방지)
      setParticipantIds([])
      setServerRoster([])
      setDrawnAt(null)
      setPairs({})

      try {
        const configSnap = await getDoc(doc(db, MANITO_COLLECTION, selectedMonth))
        const config = configSnap.exists() ? (configSnap.data() as ManitoConfig) : null
        const ids = config?.participantIds ?? []

        const loadedPairs: Record<string, string> = {}
        if (config?.drawnAt && ids.length > 0) {
          const snaps = await Promise.all(
            ids.map(id => getDoc(doc(db, MANITO_COLLECTION, manitoAssignmentId(selectedMonth, id))))
          )
          snaps.forEach(snap => {
            if (!snap.exists()) return
            const { userId, targetId } = snap.data() as ManitoAssignment
            loadedPairs[userId] = targetId
          })
        }

        if (cancelled) return
        setParticipantIds(ids)
        setServerRoster(ids)
        setDrawnAt(config?.drawnAt ?? null)
        setPairs(loadedPairs)
      } catch (e) {
        console.error(e)
        if (!cancelled) setMessage('마니또 정보를 불러오지 못했습니다.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [isManager, selectedMonth])

  const changeMonth = (delta: number) => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const newDate = new Date(year, month - 1 + delta, 1)
    setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`)
  }

  const formatMonthDisplay = () => {
    const [year, month] = selectedMonth.split('-')
    return `${year}년 ${parseInt(month)}월`
  }

  const toggleParticipant = (id: string) => {
    setParticipantIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const toggleAll = () => {
    setParticipantIds(prev => (prev.length === members.length ? [] : members.map(m => m.id)))
  }

  const configRef = () => doc(db, MANITO_COLLECTION, selectedMonth)

  const deleteAssignments = (batch: WriteBatch, ids: string[]) =>
    ids.forEach(id => batch.delete(doc(db, MANITO_COLLECTION, manitoAssignmentId(selectedMonth, id))))

  const sameRoster = (a: string[], b: string[]) =>
    a.length === b.length && [...a].sort().join() === [...b].sort().join()

  const handleSave = async () => {
    setBusy(true)
    setMessage('')
    try {
      const now = new Date().toISOString()
      // 명단이 바뀌면 기존 추첨은 짝이 깨진 상태이므로 배정 문서와 drawnAt을 함께 지운다
      const invalidate = !!drawnAt && !sameRoster(participantIds, serverRoster)
      const batch = writeBatch(db)
      if (invalidate) deleteAssignments(batch, members.map(m => m.id))
      batch.set(
        configRef(),
        { month: selectedMonth, participantIds, updatedAt: now, ...(invalidate ? { drawnAt: deleteField() } : {}) },
        { merge: true }
      )
      await batch.commit()
      setServerRoster(participantIds)
      if (invalidate) {
        setDrawnAt(null)
        setPairs({})
      }
      setMessage(invalidate ? '명단을 저장했습니다. 다시 추첨해 주세요.' : '참가자 명단을 저장했습니다.')
    } catch (e) {
      console.error(e)
      setMessage('저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const handleDraw = async () => {
    if (participantIds.length < 2) {
      setMessage('참가자를 2명 이상 선택해 주세요.')
      return
    }
    if (drawnAt && !window.confirm('이미 추첨된 달입니다. 다시 추첨하면 기존 결과가 사라집니다. 계속할까요?')) {
      return
    }

    setBusy(true)
    setMessage('')
    try {
      const result = drawManito(participantIds)
      const now = new Date().toISOString()
      const batch = writeBatch(db)

      // 참가자가 아닌 부원의 이전 배정 문서 정리 (참가자 문서는 아래 set이 덮어쓴다)
      deleteAssignments(batch, members.filter(m => !participantIds.includes(m.id)).map(m => m.id))

      Object.entries(result).forEach(([userId, targetId]) => {
        const assignment: ManitoAssignment = { month: selectedMonth, userId, targetId, createdAt: now }
        batch.set(doc(db, MANITO_COLLECTION, manitoAssignmentId(selectedMonth, userId)), assignment)
      })

      batch.set(
        configRef(),
        { month: selectedMonth, participantIds, drawnAt: now, updatedAt: now },
        { merge: true }
      )

      await batch.commit()
      setPairs(result)
      setDrawnAt(now)
      setServerRoster(participantIds)
      setMessage(`${participantIds.length}명 추첨을 완료했습니다.`)
    } catch (e) {
      console.error(e)
      setMessage(e instanceof Error ? e.message : '추첨에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const memberName = (id: string) => members.find(m => m.id === id)?.name ?? '(알 수 없음)'

  if (!isManager) {
    return (
      <div className="manito-manage-page">
        <div className="access-denied">
          <h2>접근 권한 없음</h2>
          <p>매니저만 마니또를 관리할 수 있습니다.</p>
          <a href="/" className="btn-primary">홈으로 돌아가기</a>
        </div>
      </div>
    )
  }

  return (
    <div className="manito-manage-page">
      <header className="page-header">
        <a href="/" className="back-btn">&larr; 뒤로</a>
        <h1>마니또 관리</h1>
      </header>

      <main className="page-content">
        <div className="month-selector">
          <button onClick={() => changeMonth(-1)} className="month-btn" disabled={busy}>&lt;</button>
          <span className="month-display">{formatMonthDisplay()}</span>
          <button onClick={() => changeMonth(1)} className="month-btn" disabled={busy}>&gt;</button>
        </div>

        <div className="draw-status">
          {drawnAt
            ? `추첨 완료 · ${new Date(drawnAt).toLocaleString('ko-KR')}`
            : '아직 추첨하지 않았습니다.'}
        </div>

        {message && <p className="form-message">{message}</p>}

        <section className="participants-section">
          <div className="section-head">
            <h2>참가자 ({participantIds.length}/{members.length})</h2>
            <button className="btn-small" onClick={toggleAll} disabled={busy || members.length === 0}>
              {participantIds.length === members.length && members.length > 0 ? '전체 해제' : '전체 선택'}
            </button>
          </div>

          {loading ? (
            <p className="loading-text">로딩 중...</p>
          ) : members.length === 0 ? (
            <p className="empty-text">부원이 없습니다.</p>
          ) : (
            <div className="member-list">
              {members.map(member => (
                <label key={member.id} className={`member-row ${participantIds.includes(member.id) ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={participantIds.includes(member.id)}
                    onChange={() => toggleParticipant(member.id)}
                    disabled={busy}
                  />
                  <span className="member-name">{member.name}</span>
                  <span className="member-part">{PART_LABELS[member.part]}</span>
                </label>
              ))}
            </div>
          )}
        </section>

        <div className="action-buttons">
          <button className="btn-secondary" onClick={handleSave} disabled={busy || loading}>
            저장
          </button>
          <button className="btn-primary" onClick={handleDraw} disabled={busy || loading || participantIds.length < 2}>
            {drawnAt ? '다시 추첨' : '추첨 실행'}
          </button>
        </div>

        {drawnAt && Object.keys(pairs).length > 0 && (
          <section className="result-section">
            <div className="section-head">
              <h2>추첨 결과</h2>
              <button className="btn-small" onClick={() => setShowResult(v => !v)}>
                {showResult ? '가리기' : '결과 보기'}
              </button>
            </div>
            {showResult ? (
              <div className="pair-list">
                {Object.entries(pairs).map(([userId, targetId]) => (
                  <div key={userId} className="pair-row">
                    <span className="pair-giver">{memberName(userId)}</span>
                    <span className="pair-arrow">→</span>
                    <span className="pair-target">{memberName(targetId)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-text">결과를 보면 마니또가 공개됩니다.</p>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
