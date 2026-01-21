import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

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

      // 실패한 토큰 정리
      const failedTokens: string[] = []
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx])
          console.error(`토큰 발송 실패: ${resp.error?.message}`)
        }
      })

      // 무효 토큰 제거
      if (failedTokens.length > 0) {
        const usersSnapshot = await db.collection('users')
          .where('fcmToken', 'in', failedTokens)
          .get()

        const batch = db.batch()
        usersSnapshot.docs.forEach((doc) => {
          batch.update(doc.ref, { fcmToken: FieldValue.delete() })
        })
        await batch.commit()
        console.log(`${failedTokens.length}개의 무효 토큰 제거됨`)
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
