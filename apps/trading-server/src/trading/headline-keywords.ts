// 매수 직후(비동기, 매수 자체는 안 막음) 그 종목의 최근 뉴스 제목을 가져와서 호재/악재성
// 키워드가 있는지만 표시해두는 회고용 데이터(2026-08-14). 아직 매수/매도 조건으로는 안 쓴다 -
// 며칠 데이터를 쌓아서 승패와 실제 상관관계가 있는지 먼저 확인한 뒤 결정하기로 함.
export const POSITIVE_KEYWORDS = [
  '깜짝',
  '역대 최대',
  '최대 실적',
  '사상 최대',
  '흑자전환',
  '수주',
  '계약',
  '특허',
  '승인',
  'MOU',
  '업무협약',
  '자사주 매입',
  '자사주 소각',
  '무상증자',
  '호실적',
];

export const NEGATIVE_KEYWORDS = [
  '급락',
  '적자',
  '상장폐지',
  '감사의견 거절',
  '감사의견 한정',
  '유상증자',
  '횡령',
  '배임',
  '소송',
  '하한가',
];

export type HeadlineSentiment = 'positive' | 'negative' | 'neutral';

export interface HeadlineClassification {
  sentiment: HeadlineSentiment;
  // 실제로 매칭된 키워드 원문 (positive/negative일 때만 값이 있음) - 나중에 키워드별로도
  // 승패를 나눠볼 수 있게 남겨둔다.
  keyword: string | null;
}

// 긍정 키워드를 먼저 확인 - "깜짝 적자" 같은 드문 조합은 실제로는 악재이므로, 이후 데이터를
// 보고 우선순위나 키워드 목록 자체를 조정할 수 있다.
export function classifyHeadline(title: string): HeadlineClassification {
  const positiveMatch = POSITIVE_KEYWORDS.find((keyword) => title.includes(keyword));
  if (positiveMatch) {
    return { sentiment: 'positive', keyword: positiveMatch };
  }

  const negativeMatch = NEGATIVE_KEYWORDS.find((keyword) => title.includes(keyword));
  if (negativeMatch) {
    return { sentiment: 'negative', keyword: negativeMatch };
  }

  return { sentiment: 'neutral', keyword: null };
}