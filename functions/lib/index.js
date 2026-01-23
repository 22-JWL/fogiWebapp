"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkBirthdays = exports.onUserCreated = exports.checkScheduleReminders = exports.sendPushNotification = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
(0, app_1.initializeApp)();
const db = (0, firestore_2.getFirestore)();
const messaging = (0, messaging_1.getMessaging)();
const SCHEDULE_TYPE_LABELS = {
    practice: '연습',
    performance: '공연',
    meeting: '회식',
    birthday: '생일'
};
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
                click_action: 'OPEN_APP'
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
// 한국 시간 (UTC+9) 가져오기
function getKoreaTime() {
    const now = new Date();
    // UTC 시간에 9시간 추가
    return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}
// 한국 시간 기준 날짜 문자열 (YYYY-MM-DD)
function getKoreaDateString(date) {
    return date.toISOString().split('T')[0];
}
// 일정 시작 시간을 UTC timestamp로 변환 (한국 시간 기준 입력)
function getScheduleTimestamp(dateStr, timeStr) {
    // dateStr: "2025-01-23", timeStr: "19:00"
    // 한국 시간으로 해석하여 UTC timestamp 반환
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    // UTC 기준으로 Date 생성 후 9시간 빼기 (한국 시간 -> UTC)
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours - 9, minutes, 0));
    return utcDate.getTime();
}
// 매분 실행되어 미리 알림 체크 및 발송
exports.checkScheduleReminders = (0, scheduler_1.onSchedule)({
    schedule: '* * * * *', // 매분 실행 (cron 문법)
    region: 'asia-northeast3',
    timeZone: 'Asia/Seoul'
}, async () => {
    const koreaTime = getKoreaTime();
    const nowTimestamp = Date.now();
    console.log(`[리마인더] 체크 시작 - 한국시간: ${koreaTime.toISOString()}`);
    // 오늘부터 3일간 일정 조회
    const dates = [];
    for (let i = 0; i < 3; i++) {
        const d = new Date(koreaTime);
        d.setDate(d.getDate() + i);
        dates.push(getKoreaDateString(d));
    }
    console.log(`[리마인더] 조회 날짜: ${dates.join(', ')}`);
    try {
        // 해당 기간 일정 조회
        const schedulesSnapshot = await db.collection('schedules')
            .where('date', 'in', dates)
            .get();
        console.log(`[리마인더] 조회된 일정 수: ${schedulesSnapshot.size}`);
        if (schedulesSnapshot.empty) {
            console.log('[리마인더] 해당 기간 일정 없음');
            return;
        }
        // FCM 토큰이 있는 모든 사용자 조회
        const usersSnapshot = await db.collection('users').get();
        const tokens = [];
        usersSnapshot.forEach((userDoc) => {
            const userData = userDoc.data();
            if (userData.fcmToken) {
                tokens.push(userData.fcmToken);
            }
        });
        console.log(`[리마인더] FCM 토큰 수: ${tokens.length}`);
        if (tokens.length === 0) {
            console.log('[리마인더] 발송할 토큰 없음');
            return;
        }
        // 각 일정의 리마인더 체크
        for (const scheduleDoc of schedulesSnapshot.docs) {
            const schedule = scheduleDoc.data();
            if (!schedule.reminders || schedule.reminders.length === 0) {
                continue;
            }
            console.log(`[리마인더] 일정 체크: ${schedule.title} (${schedule.date} ${schedule.startTime})`);
            console.log(`[리마인더] 설정된 리마인더: ${schedule.reminders.map(r => r.label).join(', ')}`);
            // 일정 시작 시간 (UTC timestamp)
            const scheduleTimestamp = getScheduleTimestamp(schedule.date, schedule.startTime);
            const sentReminders = schedule.sentReminders || [];
            console.log(`[리마인더] 이미 발송됨: ${sentReminders.join(', ') || '없음'}`);
            for (const reminder of schedule.reminders) {
                // 이미 발송된 리마인더는 스킵
                if (sentReminders.includes(reminder.minutes)) {
                    continue;
                }
                // 알림 발송 시간 계산 (일정 시작 시간 - 리마인더 분)
                const reminderTimestamp = scheduleTimestamp - reminder.minutes * 60 * 1000;
                // 현재 시간과의 차이 (분)
                const diffMs = nowTimestamp - reminderTimestamp;
                const diffMinutes = diffMs / (60 * 1000);
                console.log(`[리마인더] ${reminder.label}: 발송시간과 차이 = ${diffMinutes.toFixed(1)}분`);
                // 알림 시간이 지났고, 5분 이내면 발송 (여유를 둠)
                if (diffMinutes >= 0 && diffMinutes < 5) {
                    console.log(`[리마인더] ✅ 발송 시작: ${schedule.title} - ${reminder.label}`);
                    const typeLabel = SCHEDULE_TYPE_LABELS[schedule.type] || schedule.type;
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
                    };
                    try {
                        const response = await messaging.sendEachForMulticast(message);
                        console.log(`[리마인더] 발송 완료: ${response.successCount}개 성공, ${response.failureCount}개 실패`);
                        // 발송된 리마인더 기록
                        await scheduleDoc.ref.update({
                            sentReminders: firestore_2.FieldValue.arrayUnion(reminder.minutes)
                        });
                        console.log(`[리마인더] sentReminders 업데이트 완료`);
                    }
                    catch (err) {
                        console.error(`[리마인더] 발송 오류:`, err);
                    }
                }
            }
        }
        console.log('[리마인더] 체크 완료');
    }
    catch (error) {
        console.error('[리마인더] 오류:', error);
    }
});
// 현재 연도의 생일 날짜 계산
function getBirthdayThisYear(birthday) {
    const koreaTime = getKoreaTime();
    const currentYear = koreaTime.getFullYear();
    // birthday: "1990-05-15" -> "2025-05-15"
    const [, month, day] = birthday.split('-');
    return `${currentYear}-${month}-${day}`;
}
// 회원가입 시 생일 일정 자동 생성
exports.onUserCreated = (0, firestore_1.onDocumentCreated)({
    document: 'users/{userId}',
    region: 'asia-northeast3'
}, async (event) => {
    const snap = event.data;
    if (!snap) {
        console.log('[생일] 데이터 없음');
        return;
    }
    const user = snap.data();
    const userId = event.params.userId;
    if (!user.birthday) {
        console.log(`[생일] ${user.name}님의 생일 정보 없음`);
        return;
    }
    console.log(`[생일] ${user.name}님 가입 - 생일: ${user.birthday}`);
    // 올해 생일 날짜 계산
    const birthdayThisYear = getBirthdayThisYear(user.birthday);
    // 생일 일정 생성
    const birthdaySchedule = {
        title: `🎂 ${user.name}님의 생일`,
        type: 'birthday',
        date: birthdayThisYear,
        startTime: '00:00',
        endTime: '23:59',
        location: '',
        description: `${user.name}님의 생일을 축하해 주세요!`,
        userId: userId,
        createdBy: 'system',
        createdAt: new Date().toISOString()
    };
    try {
        await db.collection('schedules').add(birthdaySchedule);
        console.log(`[생일] ${user.name}님의 생일 일정 생성 완료: ${birthdayThisYear}`);
    }
    catch (error) {
        console.error(`[생일] 일정 생성 오류:`, error);
    }
});
// 매일 아침 9시 생일 체크 및 알림 발송
exports.checkBirthdays = (0, scheduler_1.onSchedule)({
    schedule: '0 9 * * *', // 매일 아침 9시 (cron 문법)
    region: 'asia-northeast3',
    timeZone: 'Asia/Seoul'
}, async () => {
    const koreaTime = getKoreaTime();
    const today = getKoreaDateString(koreaTime);
    const currentYear = koreaTime.getFullYear();
    console.log(`[생일알림] 체크 시작 - 오늘: ${today}`);
    try {
        // 모든 사용자 조회
        const usersSnapshot = await db.collection('users').get();
        const birthdayUsers = [];
        const tokens = [];
        usersSnapshot.forEach((userDoc) => {
            const user = userDoc.data();
            // FCM 토큰 수집
            if (user.fcmToken) {
                tokens.push(user.fcmToken);
            }
            // 오늘 생일인 사용자 찾기
            if (user.birthday) {
                const birthdayThisYear = getBirthdayThisYear(user.birthday);
                if (birthdayThisYear === today) {
                    birthdayUsers.push({ name: user.name, userId: userDoc.id });
                }
            }
        });
        console.log(`[생일알림] 오늘 생일자: ${birthdayUsers.length}명`);
        console.log(`[생일알림] FCM 토큰: ${tokens.length}개`);
        if (birthdayUsers.length === 0) {
            console.log('[생일알림] 오늘 생일자 없음');
            return;
        }
        if (tokens.length === 0) {
            console.log('[생일알림] 발송할 토큰 없음');
            return;
        }
        // 각 생일자에 대해 알림 발송
        for (const birthdayUser of birthdayUsers) {
            console.log(`[생일알림] 🎂 ${birthdayUser.name}님 생일 알림 발송`);
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
            };
            try {
                const response = await messaging.sendEachForMulticast(message);
                console.log(`[생일알림] ${birthdayUser.name}님 알림: ${response.successCount}개 성공`);
                // 내년 생일 일정 업데이트 (연도 갱신)
                const schedulesSnapshot = await db.collection('schedules')
                    .where('type', '==', 'birthday')
                    .where('userId', '==', birthdayUser.userId)
                    .get();
                if (!schedulesSnapshot.empty) {
                    const scheduleDoc = schedulesSnapshot.docs[0];
                    const nextYear = currentYear + 1;
                    const [, month, day] = scheduleDoc.data().date.split('-');
                    const nextBirthday = `${nextYear}-${month}-${day}`;
                    await scheduleDoc.ref.update({
                        date: nextBirthday,
                        updatedAt: new Date().toISOString()
                    });
                    console.log(`[생일알림] ${birthdayUser.name}님 내년 생일 일정 업데이트: ${nextBirthday}`);
                }
            }
            catch (err) {
                console.error(`[생일알림] 발송 오류:`, err);
            }
        }
        console.log('[생일알림] 체크 완료');
    }
    catch (error) {
        console.error('[생일알림] 오류:', error);
    }
});
//# sourceMappingURL=index.js.map