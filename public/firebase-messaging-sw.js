// Firebase 서비스 워커 (백그라운드 푸시 알림 처리)
// 모바일(Android/iOS)에서 FCM 푸시 알림을 받기 위한 필수 파일

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

// Firebase 초기화 (빌드 시 환경 변수로 치환됨)
firebase.initializeApp({
  apiKey: "__VITE_FIREBASE_API_KEY__",
  authDomain: "__VITE_FIREBASE_AUTH_DOMAIN__",
  projectId: "__VITE_FIREBASE_PROJECT_ID__",
  storageBucket: "__VITE_FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__VITE_FIREBASE_MESSAGING_SENDER_ID__",
  appId: "__VITE_FIREBASE_APP_ID__"
})

const messaging = firebase.messaging()

// 백그라운드 메시지 처리 (Firebase SDK 방식)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 백그라운드 메시지 수신:', payload)

  // notification 필드가 있으면 FCM이 자동으로 알림을 표시하므로
  // data-only 메시지일 때만 수동으로 알림 표시
  if (!payload.notification && payload.data) {
    const notificationTitle = payload.data.title || '새 알림'
    const notificationOptions = {
      body: payload.data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/badge-72x72.png',
      tag: payload.data.tag || 'bandmate-notification',
      data: payload.data,
      requireInteraction: true,
      vibrate: [200, 100, 200]
    }

    self.registration.showNotification(notificationTitle, notificationOptions)
  }
})

// push 이벤트 핸들러 (data-only 메시지 및 모바일 지원을 위해 필수)
// self.addEventListener('push', (event) => {
//   console.log('[firebase-messaging-sw.js] Push 이벤트 수신:', event)

//   if (!event.data) {
//     console.log('[firebase-messaging-sw.js] Push 이벤트에 데이터가 없음')
//     return
//   }

//   let payload
//   try {
//     payload = event.data.json()
//   } catch (e) {
//     console.log('[firebase-messaging-sw.js] Push 데이터 파싱 실패:', e)
//     payload = { data: { title: '새 알림', body: event.data.text() } }
//   }

//   console.log('[firebase-messaging-sw.js] Push 페이로드:', payload)

//   // FCM이 notification 필드를 가지고 있으면 자동으로 알림을 표시함
//   // 하지만 일부 모바일 브라우저에서는 직접 처리해야 함
//   const notificationData = payload.notification || payload.data || {}
//   const title = notificationData.title || '새 알림'
//   const options = {
//     body: notificationData.body || '',
//     icon: notificationData.icon || '/pwa-192x192.png',
//     badge: '/pwa-192x192.png',
//     tag: notificationData.tag || 'bandmate-notification-' + Date.now(),
//     data: payload.data || {},
//     requireInteraction: true,
//     vibrate: [200, 100, 200],
//     actions: [
//       { action: 'open', title: '열기' },
//       { action: 'close', title: '닫기' }
//     ]
//   }

//   // notification 필드가 없을 때만 수동으로 알림 표시
//   // (notification 필드가 있으면 FCM이 자동으로 표시)
//   if (!payload.notification) {
//     event.waitUntil(
//       self.registration.showNotification(title, options)
//     )
//   }
// })

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] 알림 클릭:', event)

  const action = event.action
  event.notification.close()

  if (action === 'close') {
    return
  }

  // 앱 열기 또는 포커스
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // 이미 열린 창이 있으면 포커스
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      // 열린 창이 없으면 새 창 열기
      if (self.clients.openWindow) {
        const targetUrl = event.notification.data?.url || '/'
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})

// 알림 닫기 처리
self.addEventListener('notificationclose', (event) => {
  console.log('[firebase-messaging-sw.js] 알림 닫힘:', event)
})

// Service Worker 설치
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker 설치됨')
  // 즉시 활성화
  self.skipWaiting()
})

// Service Worker 활성화
self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] Service Worker 활성화됨')
  // 모든 클라이언트 즉시 제어
  event.waitUntil(self.clients.claim())
})
