/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope & typeof globalThis

// Workbox precache
precacheAndRoute(self.__WB_MANIFEST)

// registerType:'autoUpdate' 는 새 SW가 즉시 활성화될 때만 동작한다.
// 이 두 줄이 없으면 새 버전이 waiting 에 머물러 사용자가 구버전에 갇힌다.
self.skipWaiting()
clientsClaim()

// Firebase 설정 (빌드 시 환경변수가 주입됨)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

// Firebase compat SDK 동적 로드 및 초기화
async function initializeFirebase() {
  try {
    self.importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
    self.importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

    // @ts-expect-error firebase is loaded via importScripts
    const fb = self.firebase
    fb.initializeApp(firebaseConfig)

    const messaging = fb.messaging()

    // 백그라운드 메시지 처리
    messaging.onBackgroundMessage((payload: { notification?: { title?: string; body?: string }; data?: Record<string, string> }) => {
      console.log('[SW] 백그라운드 메시지 수신:', payload)

      // notification 필드가 있으면 Firebase SDK가 이미 알림을 표시했다 (여기서 또 띄우면 두 번 뜬다)
      // data-only 메시지일 때만 직접 표시한다
      if (payload.notification || !payload.data) return

      const notificationTitle = payload.data.title || '새 알림'
      const notificationOptions: NotificationOptions = {
        body: payload.data.body || '',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'bandmate-notification',
        data: payload.data
      }

      self.registration.showNotification(notificationTitle, notificationOptions)
    })
  } catch (error) {
    console.error('[SW] Firebase 초기화 실패:', error)
  }
}

// 알림 클릭 처리
// Firebase SDK는 fb.messaging() 시점에 자체 notificationclick 리스너를 등록하고 stopImmediatePropagation 을 부른다.
// 그보다 먼저 등록해야 SDK가 띄운 알림을 눌렀을 때도 이 리스너가 실행되어 앱이 열린다.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[SW] 알림 클릭:', event)
  event.notification.close()

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList: readonly WindowClient[]) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus()
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow('/')
        }
        return undefined
      })
  )
})

// 반드시 위 notificationclick 리스너 등록 뒤에 호출할 것 (순서가 바뀌면 알림을 눌러도 앱이 열리지 않는다)
initializeFirebase()
