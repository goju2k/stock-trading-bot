import axios from 'axios';

export interface NewsItem {
  title: string;
  pubDate: string;
}

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: '\'',
  nbsp: ' ',
};

function unescapeXml(text: string) {
  return text
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_match, entity: string) => XML_ENTITIES[entity])
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)));
}

// 구글 뉴스 RSS 검색(2026-08-14) - KIS news-title 대체. KIS 쪽은 실제 언론기사보다 KIS
// 자체생성 시황요약("코스피 상승률 상위 50종목" 등)이 대부분이라 헤드라인만으로 호재/악재를
// 판단하기 어려웠다(2026-08-14 백필 테스트: 23건 중 22건 neutral). 구글 뉴스 RSS는 종목명으로
// 검색하면 실제 언론 기사가 바로 잡힌다(확인 사례: "한화손해보험" 검색 -> "신계약 CSM 최대치
// 지속 경신" 등 실적 기사 즉시 매칭). 정식 API는 아니지만 "개인/비상업 피드리더용"으로 공개
// 문서화된 RSS 엔드포인트라 페이지 스크래핑보다 안정적 - 응답 자체가 XML이라 파싱도 가벼운
// 정규식 추출로 충분하다(전용 XML 파서 의존성 추가 안 함).
export async function searchGoogleNews(query: string): Promise<NewsItem[]> {
  const res = await axios.get<string>('https://news.google.com/rss/search', {
    params: { q: query, hl: 'ko', gl: 'KR', ceid: 'KR:ko' },
    responseType: 'text',
  });

  const itemBlocks = res.data.match(/<item>[\s\S]*?<\/item>/g) || [];
  return itemBlocks
    .map((block): NewsItem | null => {
      const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/);
      if (!titleMatch) return null;
      const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      return { title: unescapeXml(titleMatch[1]), pubDate: pubDateMatch ? pubDateMatch[1] : '' };
    })
    .filter((item): item is NewsItem => item !== null);
}