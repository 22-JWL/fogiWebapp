/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & typeof globalThis

// Workbox precache
precacheAndRoute(self.__WB_MANIFEST)

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

      const notificationTitle = payload.notification?.title || '새 알림'
      const notificationOptions: NotificationOptions = {
        body: payload.notification?.body || '',
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

initializeFirebase()

// 알림 클릭 처리
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
