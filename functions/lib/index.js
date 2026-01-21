"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotification = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
(0, app_1.initializeApp)();
const db = (0, firestore_2.getFirestore)();
const messaging = (0, messaging_1.getMessaging)();
// Firestore에 알림 문서가 생성되면 FCM 발송
exports.sendPushNotification = (0, firestore_1.onDocumentCreated)({
    document: 'notifications/{notificationId}',
    region: 'asia-northeast3'
}, async (event) => {
    const snap = event.data;
    if (!snap) {
        console.log('No data associated with the event');
        return;
    }
    const notification = snap.data();
    const { title, body, tokens } = notification;
    if (!tokens || tokens.length === 0) {
        console.log('발송할 토큰이 없습니다.');
        await snap.ref.update({ status: 'no_tokens' });
        return;
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
                click_action: 'OPEN_APP'//,
            //     title,
            //     body
            // },
            // webpush: {
            //     notification: {
            //         title,
            //         body,
            //         icon: '/pwa-192x192.png',
            //         badge: '/badge-72x72.png',
            //         vibrate: [200, 100, 200],
            //         requireInteraction: true
            //     },
            //     fcmOptions: {
            //         link: '/'
            //     }
            // },
            // android: {
            //     notification: {
            //         icon: 'ic_notification',
            //         color: '#6c5ce7',
            //         clickAction: 'OPEN_APP',
            //         channelId: 'bandmate_notifications'
            //     }
            // },
            // apns: {
            //     payload: {
            //         aps: {
            //             badge: 1,
            //             sound: 'default',
            //             contentAvailable: true
            //         }
            //     }
            },
            tokens
        };
        const response = await messaging.sendEachForMulticast(message);
        console.log(`${response.successCount}개 발송 성공, ${response.failureCount}개 실패`);
        // 실패한 토큰 정리
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
            var _a;
            if (!resp.success) {
                failedTokens.push(tokens[idx]);
                console.error(`토큰 발송 실패: ${(_a = resp.error) === null || _a === void 0 ? void 0 : _a.message}`);
            }
        });
        // 무효 토큰 제거
        if (failedTokens.length > 0) {
            const usersSnapshot = await db.collection('users')
                .where('fcmToken', 'in', failedTokens)
                .get();
            const batch = db.batch();
            usersSnapshot.docs.forEach((doc) => {
                batch.update(doc.ref, { fcmToken: firestore_2.FieldValue.delete() });
            });
            await batch.commit();
            console.log(`${failedTokens.length}개의 무효 토큰 제거됨`);
        }
        // 상태 업데이트
        await snap.ref.update({
            status: 'sent',
            sentAt: firestore_2.FieldValue.serverTimestamp(),
            successCount: response.successCount,
            failureCount: response.failureCount
        });
    }
    catch (error) {
        console.error('FCM 발송 오류:', error);
        await snap.ref.update({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
//# sourceMappingURL=index.js.map