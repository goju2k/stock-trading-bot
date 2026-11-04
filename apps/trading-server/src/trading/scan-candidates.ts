import { VolumeRankItem } from '../kis/types';
import { getPrisma } from '../lib/prisma';

// scanner.ts 한 틱에서 매수 조건을 통과한 후보들을 남긴다(회고용, 2026-11-04). 첫 후보만 매수를
// 시도하고(attempted) 나머지는 그날 다시 안 본다 - 진입 필터 후보("이 종목을 걸렀으면 다음 후보를
// 샀을 것")를 분봉으로 오프라인 시뮬레이션할 때 대체 매수 대상이 이 테이블이다. 실제 매수 여부는
// orders와 (sessionId, code)로 맞춰 본다(attempted여도 현금 부족 등으로 안 샀을 수 있음).
// 매수 경로를 막지 않도록 await 없이 부르고, 실패는 로그만 남긴다.
export function recordScanCandidates(sessionId: number, items: VolumeRankItem[], eligible: VolumeRankItem[]) {
  const seenAt = new Date();
  getPrisma().scanCandidate.createMany({
    data: eligible.map((item, index) => ({
      sessionId,
      code: item.mksc_shrn_iscd,
      name: item.hts_kor_isnm,
      seenAt,
      rank: items.indexOf(item) + 1,
      candidateCount: items.length,
      price: Number(item.stck_prpr),
      attempted: index === 0,
      row: { ...item },
    })),
  }).catch((error) => console.error('[scan-candidates] write failed', error));
}