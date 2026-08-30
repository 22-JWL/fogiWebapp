// firestore.rules의 manito 규칙 검증 (마니또 배정은 본인 외에는 보이면 안 된다)
//
// 실행:
//   npm i --no-save @firebase/rules-unit-testing@3   # firebase 10과 짝맞춤
//   JAVA_HOME=$(/usr/libexec/java_home -v 21) \
//     firebase emulators:exec --project demo-fogi --only firestore "node scripts/firestore-rules.test.mjs"
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, collection, getDocs, query, where } from 'firebase/firestore'

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-fogi',
  firestore: {
    rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    host: '127.0.0.1',
    port: 8080
  }
})

const MONTH = '2026-08'
const MGR = 'mgrUid', A = 'aliceUid', B = 'bobUid'

// 시드: users + manito 문서 (규칙 우회)
await testEnv.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore()
  await setDoc(doc(db, 'users', MGR), { name: '매니저', role: 'manager', part: 'vocal' })
  await setDoc(doc(db, 'users', A), { name: '앨리스', role: 'member', part: 'guitar' })
  await setDoc(doc(db, 'users', B), { name: '밥', role: 'member', part: 'drum' })
  await setDoc(doc(db, 'manito', MONTH), { month: MONTH, participantIds: [MGR, A, B], drawnAt: 'now', updatedAt: 'now' })
  await setDoc(doc(db, 'manito', `${MONTH}_${A}`), { month: MONTH, userId: A, targetId: B, createdAt: 'now' })
  await setDoc(doc(db, 'manito', `${MONTH}_${B}`), { month: MONTH, userId: B, targetId: MGR, createdAt: 'now' })
  await setDoc(doc(db, 'manito', `${MONTH}_${MGR}`), { month: MONTH, userId: MGR, targetId: A, createdAt: 'now' })
  await setDoc(doc(db, 'schedules', 'sch1'), { title: '연습', date: '2026-08-10', startTime: '19:00' })
  await setDoc(doc(db, 'rsvps', `sch1_${A}`), { scheduleId: 'sch1', userId: A, status: 'attending' })
  await setDoc(doc(db, 'rsvps', `sch1_${B}`), { scheduleId: 'sch1', userId: B, status: 'absent' })
  await setDoc(doc(db, 'attendances', `sch1_${A}`), { scheduleId: 'sch1', userId: A, status: 'attending' })
})

const alice = testEnv.authenticatedContext(A).firestore()
const bob = testEnv.authenticatedContext(B).firestore()
const mgr = testEnv.authenticatedContext(MGR).firestore()
const anon = testEnv.unauthenticatedContext().firestore()

const t = []
const check = async (name, fn) => {
  try { await fn(); t.push(['PASS', name]) }
  catch (e) { t.push(['FAIL', name, e.message.split('\n')[0]]) }
}

// 부원: 설정 문서 읽기 OK
await check('부원이 설정 문서 읽기 → 허용', () => assertSucceeds(getDoc(doc(alice, 'manito', MONTH))))
// 부원: 본인 배정 읽기 OK
await check('부원이 본인 배정 읽기 → 허용', () => assertSucceeds(getDoc(doc(alice, 'manito', `${MONTH}_${A}`))))
// 부원: 남의 배정 읽기 차단 (핵심)
await check('부원이 남의 배정 읽기 → 차단', () => assertFails(getDoc(doc(alice, 'manito', `${MONTH}_${B}`))))
await check('부원이 매니저 배정 읽기 → 차단', () => assertFails(getDoc(doc(bob, 'manito', `${MONTH}_${MGR}`))))
// 부원: 쓰기 전면 차단
await check('부원이 배정 문서 생성 → 차단', () => assertFails(setDoc(doc(alice, 'manito', `${MONTH}_${A}`), { targetId: MGR })))
await check('부원이 본인 배정 삭제 → 차단', () => assertFails(deleteDoc(doc(alice, 'manito', `${MONTH}_${A}`))))
await check('부원이 설정 문서 수정 → 차단', () => assertFails(setDoc(doc(alice, 'manito', MONTH), { participantIds: [A] })))
// 부원: 컬렉션 전체 쿼리 차단 (우회 경로)
await check('부원이 manito 컬렉션 전체 list → 차단', () => assertFails(getDocs(collection(alice, 'manito'))))
await check('부원이 targetId where 쿼리로 우회 → 차단', () => assertFails(getDocs(query(collection(alice, 'manito'), where('month', '==', MONTH)))))
await check('부원이 본인 userId where 쿼리 → 차단', () => assertFails(getDocs(query(collection(alice, 'manito'), where('userId', '==', A)))))
// 매니저: 전부 읽기/쓰기
await check('매니저가 남의 배정 읽기 → 허용', () => assertSucceeds(getDoc(doc(mgr, 'manito', `${MONTH}_${A}`))))
await check('매니저가 설정 문서 쓰기 → 허용', () => assertSucceeds(setDoc(doc(mgr, 'manito', MONTH), { month: MONTH, participantIds: [A, B], updatedAt: 'x' })))
await check('매니저가 배정 문서 쓰기 → 허용', () => assertSucceeds(setDoc(doc(mgr, 'manito', `${MONTH}_${A}`), { month: MONTH, userId: A, targetId: B, createdAt: 'x' })))
await check('매니저가 배정 문서 삭제 → 허용', () => assertSucceeds(deleteDoc(doc(mgr, 'manito', `${MONTH}_${B}`))))
// isManager()가 || 앞에 있어 단축평가로 통과 — 매니저만 컬렉션 전체 조회 가능
await check('매니저가 manito 컬렉션 전체 list → 허용', () => assertSucceeds(getDocs(collection(mgr, 'manito'))))
// users 권한 상승 차단 (마니또 기밀성이 isManager()에 의존하므로 필수)
await check('부원이 본인 role을 manager로 변경 → 차단', () => assertFails(updateDoc(doc(alice, 'users', A), { role: 'manager' })))
await check('부원이 role 포함 setDoc merge → 차단', () => assertFails(setDoc(doc(alice, 'users', A), { role: 'manager' }, { merge: true })))
await check('부원이 본인 name 변경 → 허용', () => assertSucceeds(updateDoc(doc(alice, 'users', A), { name: '앨리스2' })))
await check('부원이 fcmToken setDoc merge → 허용', () => assertSucceeds(setDoc(doc(alice, 'users', A), { fcmToken: 'tok', tokenUpdatedAt: 'x' }, { merge: true })))
await check('부원이 fcmToken deleteField → 허용', () => assertSucceeds(updateDoc(doc(alice, 'users', A), { fcmToken: deleteField() })))
await check('매니저가 타인 role 변경 → 허용', () => assertSucceeds(updateDoc(doc(mgr, 'users', B), { role: 'manager' })))
await check('신규 가입 본인 문서 생성 → 허용', async () => {
  const newUid = 'newUid'
  const fresh = testEnv.authenticatedContext(newUid).firestore()
  await assertSucceeds(setDoc(doc(fresh, 'users', newUid), { name: '신입', email: 'n@t.com', role: 'member', part: 'etc', birthday: '2000-01-01', createdAt: 'x' }))
})

// 일정 삭제 시 딸린 기록 정리 (매니저가 일괄 삭제한다)
await check('매니저가 남의 rsvp 삭제 → 허용', () => assertSucceeds(deleteDoc(doc(mgr, 'rsvps', `sch1_${A}`))))
await check('매니저가 출석 기록 삭제 → 허용', () => assertSucceeds(deleteDoc(doc(mgr, 'attendances', `sch1_${A}`))))
await check('매니저가 일정 삭제 → 허용', () => assertSucceeds(deleteDoc(doc(mgr, 'schedules', 'sch1'))))
await check('부원이 남의 rsvp 삭제 → 여전히 차단', () => assertFails(deleteDoc(doc(alice, 'rsvps', `sch1_${B}`))))
await check('부원이 출석 기록 삭제 → 여전히 차단', () => assertFails(deleteDoc(doc(alice, 'attendances', `sch1_${B}`))))
await check('부원이 일정 삭제 → 여전히 차단', () => assertFails(deleteDoc(doc(alice, 'schedules', 'sch1'))))
await check('부원이 scheduleId로 rsvps 조회 → 허용 (일정 삭제 로직이 쓰는 쿼리)', () =>
  assertSucceeds(getDocs(query(collection(alice, 'rsvps'), where('scheduleId', '==', 'sch1')))))

// 비로그인 전면 차단
await check('비로그인 설정 문서 읽기 → 차단', () => assertFails(getDoc(doc(anon, 'manito', MONTH))))
await check('비로그인 배정 읽기 → 차단', () => assertFails(getDoc(doc(anon, 'manito', `${MONTH}_${A}`))))

await testEnv.cleanup()

let failed = 0
for (const [s, name, msg] of t) {
  console.log(`${s === 'PASS' ? '✓' : '✗'} ${name}${msg ? '  << ' + msg : ''}`)
  if (s === 'FAIL') failed++
}
console.log(`\n${t.length - failed}/${t.length} passed`)
process.exit(failed ? 1 : 0)
