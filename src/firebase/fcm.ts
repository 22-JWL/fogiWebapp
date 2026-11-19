import { getToken, onMessage } from 'firebase/messaging'
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore'
import { db, getMessagingInstance } from './config'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

// 플랫폼 감지 유틸리티
export function getPlatformInfo() {
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /Android/.test(ua)
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as { standalone?: boolean }).standalone === true

  // iOS 버전 체크 (16.4 이상 필요)
  let iosVersion = 0
  if (isIOS) {
    const match = ua.match(/OS (\d+)_(\d+)/)
    if (match) {
      iosVersion = parseFloat(`${match[1]}.${match[2]}`)
    }
  }

  return {
    isIOS,
    isAndroid,
    isSafari,
    isStandalone,
    iosVersion,
    isMobile: isIOS || isAndroid
  }
}

// iOS 푸시 알림 지원 여부 확인
export function checkIOSPushSupport(): { supported: boolean; reason?: string } {
  const { isIOS, iosVersion, isStandalone, isSafari } = getPlatformInfo()

  if (!isIOS) {
    return { supported: true }
  }

  // iosVersion 0 = 버전을 알 수 없음 (iPadOS는 데스크톱 UA라 버전이 안 잡힌다). 모르는 버전은 막지 않는다
  if (iosVersion > 0 && iosVersion < 16.4) {
    return {
      supported: false,
      reason: `iOS ${iosVersion}에서는 푸시 알림을 지원하지 않습니다. iOS 16.4 이상으로 업데이트해 주세요.`
    }
  }

  if (!isStandalone) {
    return {
      supported: false,
      reason: isSafari
        ? '푸시 알림을 받으려면 앱을 홈 화면에 추가해 주세요. Safari 하단의 공유 버튼 → "홈 화면에 추가"를 탭하세요.'
        : '푸시 알림을 받으려면 Safari에서 열고 홈 화면에 추가해 주세요.'
    }
  }

  // 버전 대신 실제 기능 유무로 판단한다
  if (!('Notification' in window) || !('PushManager' in window)) {
    return {
      supported: false,
      reason: '이 기기에서는 푸시 알림을 사용할 수 없습니다. iOS 16.4 이상인지 확인해 주세요.'
    }
  }

  return { supported: true }
}

// Firebase Messaging Service Worker 등록
async function registerFCMServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('[FCM] Service Worker를 지원하지 않는 브라우저입니다.')
    return null
  }

  try {
    // firebase-messaging-sw.js를 명시적으로 등록
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    })

    console.log('[FCM] Service Worker 등록 성공:', registration.scope)

    // SW가 활성화될 때까지 대기
    if (registration.installing) {
      await new Promise<void>((resolve) => {
        registration.installing!.addEventListener('statechange', function handler(e) {
          if ((e.target as ServiceWorker).state === 'activated') {
            registration.installing?.removeEventListener('statechange', handler)
            resolve()
          }
        })
      })
    } else if (registration.waiting) {
      await new Promise<void>((resolve) => {
        registration.waiting!.addEventListener('statechange', function handler(e) {
          if ((e.target as ServiceWorker).state === 'activated') {
            registration.waiting?.removeEventListener('statechange', handler)
            resolve()
          }
        })
      })
    }

    // 최신 SW가 활성화되었는지 확인
    await navigator.serviceWorker.ready
    console.log('[FCM] Service Worker 활성화 완료')

    return registration
  } catch (error) {
    console.error('[FCM] Service Worker 등록 실패:', error)
    return null
  }
}

// FCM 토큰 요청 및 저장
export async function requestNotificationPermission(userId: string): Promise<string | null> {
  console.log('[FCM] 알림 권한 요청 시작, userId:', userId)
  console.log('[FCM] VAPID_KEY:', VAPID_KEY ? '설정됨' : '없음')

  const platform = getPlatformInfo()
  console.log('[FCM] 플랫폼 정보:', platform)

  // iOS 지원 여부 확인
  const iosCheck = checkIOSPushSupport()
  if (!iosCheck.supported) {
    console.log('[FCM] iOS 푸시 미지원:', iosCheck.reason)
    throw new Error(iosCheck.reason)
  }

  try {
    // Service Worker 먼저 등록
    const swRegistration = await registerFCMServiceWorker()
    if (!swRegistration) {
      console.log('[FCM] Service Worker 등록에 실패했습니다.')
      return null
    }

    const permission = await Notification.requestPermission()
    console.log('[FCM] 알림 권한 상태:', permission)

    if (permission !== 'granted') {
      console.log('[FCM] 알림 권한이 거부되었습니다.')
      return null
    }

    const messaging = await getMessagingInstance()
    console.log('[FCM] messaging 인스턴스:', messaging ? '있음' : '없음')

    if (!messaging) {
      console.log('[FCM] 이 브라우저는 FCM을 지원하지 않습니다.')
      return null
    }

    console.log('[FCM] getToken 호출 중...')
    // serviceWorkerRegistration 옵션 추가 - 모바일에서 필수!
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration
    })
    console.log('[FCM] 받은 토큰:', token ? token.substring(0, 20) + '...' : '없음')

    if (token) {
      // Firestore에 토큰 저장 (플랫폼 정보 포함)
      await saveTokenToFirestore(userId, token, platform)
      console.log('[FCM] 토큰 Firestore 저장 완료')
      return token
    }

    return null
  } catch (error) {
    console.error('[FCM] 토큰 요청 실패:', error)
    throw error
  }
}

// Firestore에 FCM 토큰 저장 (기기마다 하나씩 fcmTokens 에 쌓는다. 구버전 fcmToken 은 더 이상 쓰지 않는다)
async function saveTokenToFirestore(
  userId: string,
  token: string,
  platform: ReturnType<typeof getPlatformInfo>
) {
  const userRef = doc(db, 'users', userId)
  await setDoc(userRef, {
    fcmTokens: arrayUnion(token),
    tokenUpdatedAt: new Date().toISOString(),
    tokenPlatform: platform.isIOS ? 'ios' : platform.isAndroid ? 'android' : 'web',
    tokenIsStandalone: platform.isStandalone
  }, { merge: true })
}

// 포그라운드 메시지 리스너 설정
export async function setupForegroundMessageListener(
  onMessageReceived: (payload: { title: string; body: string }) => void
) {
  const messaging = await getMessagingInstance()
  if (!messaging) return () => {}

  // 해제 함수를 돌려줘야 언마운트 때 정리할 수 있다 (안 하면 탭 이동마다 리스너가 쌓인다)
  return onMessage(messaging, (payload) => {
    console.log('포그라운드 메시지 수신:', payload)

    const title = payload.notification?.title || '새 알림'
    const body = payload.notification?.body || ''

    onMessageReceived({ title, body })
  })
}

// 한 사용자의 토큰 = 기기별 fcmTokens + 구버전 단일 fcmToken (중복 제거)
// users 문서는 본인이 쓸 수 있는 값이라, 배열이 아니면 버린다 (안 그러면 문서 하나가 발송 전체를 죽인다)
export function userTokens(data: { fcmToken?: string; fcmTokens?: string[] }): string[] {
  return [...new Set([...(Array.isArray(data.fcmTokens) ? data.fcmTokens : []), ...(data.fcmToken ? [data.fcmToken] : [])])]
}

// 이 기기의 현재 FCM 토큰. 권한 요청 창을 띄우지 않고 SW 스크립트도 등록하지 않는다
export async function getDeviceToken(): Promise<string | null> {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return null

    const messaging = await getMessagingInstance()
    if (!messaging) return null

    // 이미 등록된 SW만 쓴다 (registerFCMServiceWorker 를 부르면 페이지를 열 때마다 활성 SW가 바뀐다)
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) return null

    // 푸시 구독이 없으면 토큰도 없다 (getToken 은 구독이 없으면 새로 만들어 버린다)
    if (!(await registration.pushManager.getSubscription())) return null

    return (await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    })) || null
  } catch (error) {
    console.error('[FCM] 기기 토큰 조회 실패:', error)
    return null
  }
}

// 이 기기가 해당 사용자의 알림 수신 기기로 등록돼 있는지
export async function isDeviceRegistered(userId: string): Promise<boolean> {
  const token = await getDeviceToken()
  if (!token) return false

  const userDoc = await getDoc(doc(db, 'users', userId))
  return userDoc.exists() && userTokens(userDoc.data()).includes(token)
}

// 이 기기의 토큰만 지운다 (같은 계정의 다른 기기 알림은 그대로 둔다)
export async function disableDeviceNotifications(userId: string): Promise<void> {
  const token = await getDeviceToken()
  if (!token) return

  const userRef = doc(db, 'users', userId)
  const userDoc = await getDoc(userRef)
  if (!userDoc.exists()) return

  await updateDoc(userRef, {
    fcmTokens: arrayRemove(token),
    // 구버전 단일 토큰이 이 기기의 것이면 함께 지운다
    ...(userDoc.data().fcmToken === token ? { fcmToken: deleteField() } : {})
  })
}
