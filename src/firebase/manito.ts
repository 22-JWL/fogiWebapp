// 마니또 컬렉션 규칙
// - 설정 문서: `{YYYY-MM}`           (참가자 명단, 전원 읽기 가능)
// - 배정 문서: `{YYYY-MM}_{userId}`  (본인과 매니저만 읽기 가능 — firestore.rules가 이 ID 형식에 의존)
export const MANITO_COLLECTION = 'manito'

export const manitoAssignmentId = (month: string, userId: string) => `${month}_${userId}`

/**
 * 마니또 추첨: 셔플 후 순환 배정(shuffled[i] -> shuffled[i+1]).
 * 자기 자신이 배정되는 경우가 구조적으로 발생하지 않아 재시도 루프가 필요 없다.
 * ponytail: 단일 순환이라 균등 derangement은 아님(A->B면 B->A가 불가능). 균등성이 필요해지면 재시도 셔플로 교체.
 */
export function drawManito(userIds: string[]): Record<string, string> {
  if (userIds.length < 2) {
    throw new Error('마니또 추첨은 2명 이상부터 가능합니다.')
  }
  if (new Set(userIds).size !== userIds.length) {
    throw new Error('참가자 목록에 중복이 있습니다.')
  }

  const shuffled = [...userIds]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const pairs: Record<string, string> = {}
  shuffled.forEach((giver, i) => {
    pairs[giver] = shuffled[(i + 1) % shuffled.length]
  })
  return pairs
}
