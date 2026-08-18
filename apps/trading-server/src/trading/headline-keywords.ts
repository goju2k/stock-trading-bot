// 매수 직후(비동기, 매수 자체는 안 막음) 그 종목의 최근 뉴스 제목을 가져와서 호재/악재성
// 키워드가 있는지만 표시해두는 회고용 데이터(2026-08-14). 아직 매수/매도 조건으로는 안 쓴다 -
// 며칠 데이터를 쌓아서 승패와 실제 상관관계가 있는지 먼저 확인한 뒤 결정하기로 함.
// 2026-08-18: 실제 헤드라인(구글 뉴스)을 이틀치 확인해보니 "호실적"/"최대 실적" 같은 정형
// 문구보다 "전년比 58.7%↑" 식으로 숫자+화살표로만 실적을 표현하는 기사가 훨씬 많았다
// (8/14 23건 중 1건, 8/18 16건 중 0건만 키워드 매칭 - 실제로는 혜인/제너셈/삼성공조 등 여러
// 건이 명백한 호재/급등 기사였는데도 전부 놓침). 단순 문자열 포함 대신 정규식 패턴으로 바꿔서
// 방향성 있는 숫자 표현과 급등/급락, 수급(순매수·순매도) 표현을 잡는다.
export const POSITIVE_PATTERNS: RegExp[] = [
  /깜짝/,
  /역대\s?최대/,
  /최대\s?실적/,
  /사상\s?최대/,
  /흑자\s?전환/,
  /수주/,
  /계약/,
  /특허/,
  /승인/,
  /MOU|업무협약/,
  /자사주\s?매입/,
  /자사주\s?소각/,
  /무상증자/,
  /호실적/,
  // "전년比 58.7%↑", "전년비 56.8% 증가", "전년대비 211%↑" 같은 표현 - 전년(비/대비/比) 뒤
  // 12자 이내에 숫자%가 나오고 그 뒤로 방향 표시(↑/증가/상승)가 붙는 경우.
  /전년\s?(비|대비|比)[^%]{0,12}\d+(\.\d+)?\s*%\s*(↑|증가|상승)/,
  /상한가/,
  /급등/,
  /순매수/,
  // 방향(상승/하락) 구분은 안 하지만, 매수 직후 시점 헤드라인이라 상승 쪽일 가능성이 높다는
  // 가정으로 우선 positive에 둔다 - 데이터 쌓이면 재검토.
  /VI\s?발동/,
];

export const NEGATIVE_PATTERNS: RegExp[] = [
  /급락/,
  /적자/,
  /상장폐지/,
  /감사의견\s?거절/,
  /감사의견\s?한정/,
  /유상증자/,
  /횡령/,
  /배임/,
  /소송/,
  /하한가/,
  /전년\s?(비|대비|比)[^%]{0,12}\d+(\.\d+)?\s*%\s*(↓|감소|하락)/,
  /순매도/,
  // KRX 투자경고/주의 지정, 공매도 과열종목 지정 - 2026-08-14 백필 때 관찰한 경고성 헤드라인.
  /투자주의|투자경고/,
  /공매도\s?과열/,
];

export type HeadlineSentiment = 'positive' | 'negative' | 'neutral';

export interface HeadlineClassification {
  sentiment: HeadlineSentiment;
  // 실제로 매칭된 텍스트 (positive/negative일 때만 값이 있음) - 단순 키워드면 그 단어,
  // 패턴 매칭이면 매칭된 구간 전체(예: "전년比 58.7%↑")를 그대로 남겨서 나중에 어떤 패턴이
  // 승패와 관련 있는지 구체적으로 살펴볼 수 있게 한다.
  keyword: string | null;
}

// 긍정 패턴을 먼저 확인 - "깜짝 적자" 같은 드문 조합은 실제로는 악재이므로, 이후 데이터를
// 보고 우선순위나 패턴 목록 자체를 조정할 수 있다.
export function classifyHeadline(title: string): HeadlineClassification {
  const positiveMatch = POSITIVE_PATTERNS.map((pattern) => title.match(pattern)).find((match) => match !== null);
  if (positiveMatch) {
    return { sentiment: 'positive', keyword: positiveMatch[0] };
  }

  const negativeMatch = NEGATIVE_PATTERNS.map((pattern) => title.match(pattern)).find((match) => match !== null);
  if (negativeMatch) {
    return { sentiment: 'negative', keyword: negativeMatch[0] };
  }

  return { sentiment: 'neutral', keyword: null };
}