import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import {
  getKoreaTime,
  getKoreaDateString,
  getScheduleTimestamp,
  isValidBirthday,
  sanitizeName,
  getNextBirthday
} from './dates'

initializeApp()

const db = getFirestore()
const messaging = getMessaging()

interface NotificationDoc {
  title: string
  body: string
  tokens: string[]
  status: string
  createdBy: string
  createdAt: string
}

interface Reminder {
  minutes: number
  label: string
}

interface ScheduleDoc {
  id?: string
  title: string
  type: 'practice' | 'performance' | 'meeting' | 'birthday'
  date: string
  startTime: string
  location: string
  reminders?: Reminder[]
  sentReminders?: number[]
  userId?: string  // 생일 일정의 경우 해당 사용자 ID
}

interface UserDoc {
  name: string
  email: string
  birthday: string  // YYYY-MM-DD
  role: string
  part: string
  fcmToken?: string
}

// 이 코드만 토큰을 영구 삭제한다. '토큰이 죽었다'는 뜻인 코드만 넣을 것.
const DEAD_TOKEN_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument'
]

// Firestore 'in' 필터 값 개수 상한
const IN_QUERY_LIMIT = 30

// 미리 알림으로 지정할 수 있는 최대 일수. ScheduleManagePage 의 '일 전' 입력 상한과 반드시 같아야 한다.
const MAX_REMINDER_DAYS = 30

const SCHEDULE_TYPE_LABELS: Record<string, string> = {
  practice: '연습',
  performance: '공연',
  meeting: '회식',
  birthday: '생일'
}

// Firestore에 알림 문서가 생성되면 FCM 발송
export const sendPushNotification = onDocumentCreated(
  {
    document: 'notifications/{notificationId}',
    region: 'asia-northeast3'
  },
  async (event) => {
    const snap = event.data
    if (!snap) {
      console.log('No data associated with the event')
      return
    }

    const notification = snap.data() as NotificationDoc
    const { title, body, tokens } = notification

    // onDocumentCreated 는 최소 1회 전달이라 중복 실행될 수 있다.
    // status 를 선점해 같은 알림이 두 번 나가는 것을 막는다.
    const claimed = await db.runTransaction(async (tx) => {
      const cur = await tx.get(snap.ref)
      if (cur.get('status') !== 'pending') return false
      tx.update(snap.ref, { status: 'sending' })
      return true
    })
    if (!claimed) {
      console.log('이미 처리된 알림입니다. 중복 실행 건너뜀')
      return
    }

    if (!tokens || tokens.length === 0) {
      console.log('발송할 토큰이 없습니다.')
      await snap.ref.update({ status: 'no_tokens' })
      return
    }

    try {
      // 멀티캐스트 메시지 발송
      const message = {
        notification: {
          title,
          body
        },
        data: {
          notificationId: event.params.notificationId,
          click_action: 'OPEN_APP'
        },
        tokens
      }

      const response = await messaging.sendEachForMulticast(message)

      console.log(`${response.successCount}개 발송 성공, ${response.failureCount}개 실패`)

      // 토큰이 실제로 죽었을 때만 지운다.
      // 503/500/APNs 설정 오류까지 무효로 보면 일시적 장애 한 번에 전원이 알림에서 조용히 빠진다.
      const failedTokens: string[] = []
      response.responses.forEach((resp, idx) => {
        if (resp.success) return
        const code = resp.error?.code ?? ''
        console.error(`토큰 발송 실패: ${code} ${resp.error?.message}`)
        if (DEAD_TOKEN_CODES.includes(code)) {
          failedTokens.push(tokens[idx])
        }
      })

      // 정리는 실패해도 발송 결과를 오염시키면 안 된다 (푸시는 이미 나갔다)
      if (failedTokens.length > 0) {
        try {
          // Firestore 'in' 은 값 30개가 상한이라 잘라서 조회한다
          for (let i = 0; i < failedTokens.length; i += IN_QUERY_LIMIT) {
            const chunk = failedTokens.slice(i, i + IN_QUERY_LIMIT)
            const usersSnapshot = await db.collection('users')
              .where('fcmToken', 'in', chunk)
              .get()

            const batch = db.batch()
            usersSnapshot.docs.forEach((doc) => {
              batch.update(doc.ref, { fcmToken: FieldValue.delete() })
            })
            await batch.commit()
          }
          console.log(`${failedTokens.length}개의 무효 토큰 제거됨`)
        } catch (cleanupError) {
          console.error('무효 토큰 정리 실패 (발송 자체는 성공):', cleanupError)
        }
      }

      // 상태 업데이트
      await snap.ref.update({
        status: 'sent',
        sentAt: FieldValue.serverTimestamp(),
        successCount: response.successCount,
        failureCount: response.failureCount
      })
    } catch (error) {
      console.error('FCM 발송 오류:', error)
      await snap.ref.update({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)

// 매분 실행되어 미리 알림 체크 및 발송
export const checkScheduleReminders = onSchedule(
  {
    schedule: '* * * * *',  // 매분 실행 (cron 문법)
    region: 'asia-northeast3',
    timeZone: 'Asia/Seoul'
  },
  async () => {
    const koreaTime = getKoreaTime()
    const nowTimestamp = Date.now()

    console.log(`[리마인더] v2 체크 시작 - 한국시간: ${koreaTime.toISOString()}`)

    // 미리 알림 최대치(MAX_REMINDER_DAYS)만큼 앞을 봐야 한다.
    // 창이 좁으면 그보다 앞선 알림은 일정이 조회되지도 않아 영영 발송되지 않는다.
    const from = getKoreaDateString(koreaTime)
    const until = new Date(koreaTime)
    until.setUTCDate(until.getUTCDate() + MAX_REMINDER_DAYS)
    const to = getKoreaDateString(until)

    console.log(`[리마인더] 조회 범위: ${from} ~ ${to}`)

    try {
      // 해당 기간 일정 조회
      const schedulesSnapshot = await db.collection('schedules')
        .where('date', '>=', from)
        .where('date', '<=', to)
        .get()

      console.log(`[리마인더] 조회된 일정 수: ${schedulesSnapshot.size}`)

      if (schedulesSnapshot.empty) {
        console.log('[리마인더] 해당 기간 일정 없음')
        return
      }

      // 토큰 조회는 실제로 발송할 리마인더가 생겼을 때 한 번만 한다
      // (매분 users 전체를 읽으면 보낼 게 없어도 하루 수만 건의 읽기가 발생한다)
      let cachedTokens: string[] | null = null
      const getTokens = async (): Promise<string[]> => {
        if (cachedTokens) return cachedTokens
        const usersSnapshot = await db.collection('users').get()
        const list: string[] = []
        usersSnapshot.forEach((userDoc) => {
          const token = userDoc.data().fcmToken
          if (token) list.push(token)
        })
        cachedTokens = list
        console.log(`[리마인더] FCM 토큰 수: ${list.length}`)
        return list
      }

      // 각 일정의 리마인더 체크
      for (const scheduleDoc of schedulesSnapshot.docs) {
        const schedule = scheduleDoc.data() as ScheduleDoc

        if (!schedule.reminders || schedule.reminders.length === 0) {
          continue
        }

        console.log(`[리마인더] 일정 체크: ${schedule.title} (${schedule.date} ${schedule.startTime})`)
        console.log(`[리마인더] 설정된 리마인더: ${schedule.reminders.map(r => r.label).join(', ')}`)

        // 일정 시작 시간 (UTC timestamp)
        const scheduleTimestamp = getScheduleTimestamp(schedule.date, schedule.startTime)
        const sentReminders = schedule.sentReminders || []

        console.log(`[리마인더] 이미 발송됨: ${sentReminders.join(', ') || '없음'}`)

        for (const reminder of schedule.reminders) {
          // 이미 발송된 리마인더는 스킵
          if (sentReminders.includes(reminder.minutes)) {
            continue
          }

          // 알림 발송 시간 계산 (일정 시작 시간 - 리마인더 분)
          const reminderTimestamp = scheduleTimestamp - reminder.minutes * 60 * 1000

          // 현재 시간과의 차이 (분)
          const diffMs = nowTimestamp - reminderTimestamp
          const diffMinutes = diffMs / (60 * 1000)

          console.log(`[리마인더] ${reminder.label}: 발송시간과 차이 = ${diffMinutes.toFixed(1)}분`)

          // 알림 시간이 지났고, 5분 이내면 발송 (여유를 둠)
          if (diffMinutes >= 0 && diffMinutes < 5) {
            console.log(`[리마인더] ✅ 발송 시작: ${schedule.title} - ${reminder.label}`)

            const tokens = await getTokens()
            if (tokens.length === 0) {
              console.log('[리마인더] 발송할 토큰 없음')
              continue
            }

            const typeLabel = SCHEDULE_TYPE_LABELS[schedule.type] || schedule.type
            const message = {
              notification: {
                title: `⏰ ${reminder.label} - ${typeLabel}`,
                body: `${schedule.title}\n${schedule.date} ${schedule.startTime} | ${schedule.location}`
              },
              data: {
                scheduleId: scheduleDoc.id,
                type: 'reminder'
              },
              tokens
            }

            try {
              const response = await messaging.sendEachForMulticast(message)
              console.log(`[리마인더] 발송 완료: ${response.successCount}개 성공, ${response.failureCount}개 실패`)

              // 발송된 리마인더 기록
              await scheduleDoc.ref.update({
                sentReminders: FieldValue.arrayUnion(reminder.minutes)
              })
              console.log(`[리마인더] sentReminders 업데이트 완료`)
            } catch (err) {
              console.error(`[리마인더] 발송 오류:`, err)
            }
          }
        }
      }

      console.log('[리마인더] 체크 완료')
    } catch (error) {
      console.error('[리마인더] 오류:', error)
    }
  }
)

// 회원가입 시 생일 일정 자동 생성
export const onUserCreated = onDocumentCreated(
  {
    document: 'users/{userId}',
    region: 'asia-northeast3'
  },
  async (event) => {
    const snap = event.data
    if (!snap) {
      console.log('[생일] 데이터 없음')
      return
    }

    const user = snap.data() as UserDoc
    const userId = event.params.userId

    // 이 트리거는 가입자가 직접 만든 문서로 실행된다.
    // schedules 는 매니저만 쓸 수 있는데 이 함수는 admin 권한이므로, 검증 없이 넘기면
    // 부원이 전 부원에게 보이는 일정에 임의 문구를 넣는 우회로가 된다.
    if (!isValidBirthday(user.birthday)) {
      console.log(`[생일] 생일 형식이 올바르지 않음: ${JSON.stringify(user.birthday)}`)
      return
    }

    const safeName = sanitizeName(user.name)

    console.log(`[생일] ${safeName}님 가입 - 생일: ${user.birthday}`)

    // 올해 생일 날짜 계산
    const birthdayThisYear = getNextBirthday(user.birthday)

    // 생일 일정 생성
    const birthdaySchedule = {
      title: `🎂 ${safeName}님의 생일`,
      type: 'birthday',
      date: birthdayThisYear,
      startTime: '00:00',
      endTime: '23:59',
      location: '',
      description: `${safeName}님의 생일을 축하해 주세요!`,
      userId: userId,
      createdBy: 'system',
      createdAt: new Date().toISOString()
    }

    try {
      // 문서 ID를 사용자에 고정한다 — 트리거가 중복 전달돼도 생일 일정이 여러 개 생기지 않는다
      await db.collection('schedules').doc(`birthday_${userId}`).set(birthdaySchedule)
      console.log(`[생일] ${safeName}님의 생일 일정 생성 완료: ${birthdayThisYear}`)
    } catch (error) {
      console.error(`[생일] 일정 생성 오류:`, error)
    }
  }
)

// 생일 일정의 date 를 항상 '다음 생일'로 유지한다 (놓친 실행도 다음날 자동 복구)
async function syncBirthdaySchedules(
  usersSnapshot: FirebaseFirestore.QuerySnapshot
): Promise<void> {
  const schedulesSnapshot = await db.collection('schedules').where('type', '==', 'birthday').get()
  const byUser = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
  schedulesSnapshot.forEach((doc) => {
    const uid = doc.data().userId
    if (uid && !byUser.has(uid)) byUser.set(uid, doc)
  })

  const batch = db.batch()
  let changed = 0
  usersSnapshot.forEach((userDoc) => {
    const user = userDoc.data() as UserDoc
    if (!isValidBirthday(user.birthday)) return
    const scheduleDoc = byUser.get(userDoc.id)
    if (!scheduleDoc) return
    const next = getNextBirthday(user.birthday)
    if (scheduleDoc.data().date === next) return
    batch.update(scheduleDoc.ref, { date: next, updatedAt: new Date().toISOString() })
    changed++
  })

  if (changed > 0) {
    await batch.commit()
    console.log(`[생일알림] 생일 일정 ${changed}건 날짜 갱신`)
  }
}

// 매일 아침 9시 생일 체크 및 알림 발송
export const checkBirthdays = onSchedule(
  {
    schedule: '0 9 * * *',  // 매일 아침 9시 (cron 문법)
    region: 'asia-northeast3',
    timeZone: 'Asia/Seoul'
  },
  async () => {
    const koreaTime = getKoreaTime()
    const today = getKoreaDateString(koreaTime)

    console.log(`[생일알림] 체크 시작 - 오늘: ${today}`)

    try {
      // 모든 사용자 조회
      const usersSnapshot = await db.collection('users').get()
      const birthdayUsers: { name: string; userId: string }[] = []
      const tokens: string[] = []

      usersSnapshot.forEach((userDoc) => {
        const user = userDoc.data() as UserDoc

        // FCM 토큰 수집
        if (user.fcmToken) {
          tokens.push(user.fcmToken)
        }

        // 오늘 생일인 사용자 찾기
        if (isValidBirthday(user.birthday)) {
          const birthdayThisYear = getNextBirthday(user.birthday)
          if (birthdayThisYear === today) {
            birthdayUsers.push({ name: sanitizeName(user.name), userId: userDoc.id })
          }
        }
      })

      console.log(`[생일알림] 오늘 생일자: ${birthdayUsers.length}명`)
      console.log(`[생일알림] FCM 토큰: ${tokens.length}개`)

      // 생일 일정 날짜를 매일 '다음 생일'로 맞춘다.
      // 알림 발송과 분리해 두어야 하루 실행을 놓쳐도 다음날 저절로 복구되고,
      // 생일 당일에는 오늘 날짜가 유지돼 캘린더에서 사라지지 않는다.
      await syncBirthdaySchedules(usersSnapshot)

      if (birthdayUsers.length === 0) {
        console.log('[생일알림] 오늘 생일자 없음')
        return
      }

      if (tokens.length === 0) {
        console.log('[생일알림] 발송할 토큰 없음')
        return
      }

      // 각 생일자에 대해 알림 발송
      for (const birthdayUser of birthdayUsers) {
        console.log(`[생일알림] 🎂 ${birthdayUser.name}님 생일 알림 발송`)

        const message = {
          notification: {
            title: '🎂 생일 축하합니다!',
            body: `오늘은 ${birthdayUser.name}님의 생일입니다! 축하 메시지를 보내주세요.`
          },
          data: {
            type: 'birthday',
            userId: birthdayUser.userId
          },
          tokens
        }

        try {
          const response = await messaging.sendEachForMulticast(message)
          console.log(`[생일알림] ${birthdayUser.name}님 알림: ${response.successCount}개 성공`)

        } catch (err) {
          console.error(`[생일알림] 발송 오류:`, err)
        }
      }

      console.log('[생일알림] 체크 완료')
    } catch (error) {
      console.error('[생일알림] 오류:', error)
    }
  }
)
