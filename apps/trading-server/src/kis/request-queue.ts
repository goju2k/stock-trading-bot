import { KisEnvName } from './env';

// KIS 공식 공지(API Portal 공지사항, 기준일 2026-04-20) 기준 REST 초당 호출 제한:
// 실전 18건(기존 20건에서 하향) / 모의 1건(기존 2건에서 하향), 계좌(앱키) 단위 적용.
// "동시 호출시 100~150ms 텀 권장"까지 감안해 한도보다 더 보수적으로 기본값을 잡고,
// 실측 후 조정할 수 있도록 env var로 오버라이드 가능하게 뒀다.
const DEFAULT_MIN_INTERVAL_MS: Record<KisEnvName, number> = {
  real: 60, // 18건/초 한도(55.5ms)에 여유를 두고 ~16.6건/초로 페이싱
  paper: 1100, // 1건/초 한도보다 살짝 더 보수적으로
};

function resolveMinIntervalMs(env: KisEnvName): number {
  const override = process.env[env === 'real' ? 'KIS_RATE_LIMIT_REAL_MS' : 'KIS_RATE_LIMIT_PAPER_MS'];
  const parsed = override ? Number(override) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MIN_INTERVAL_MS[env];
}

// env(paper/real)별로 별도 큐를 둔다 - 각각 별도 appkey/계좌라 레이트리밋 예산도 분리돼 있다.
// 버스트를 허용하는 토큰버킷 대신, 매 요청 "시작 시각" 사이에 최소 간격만 강제하는 직렬 큐로
// 단순하게 구현했다 (응답이 올 때까지 다음 요청을 막지는 않음 - 처리량은 유지하면서 발신 속도만
// 제한). 오늘(2026-08-02) 13종목을 몇 초 간격으로 연속 매수 + 1초 주기 잔고폴링이 겹치면서
// 모의투자 레이트리밋에 걸려 매도 주문 하나가 처리되지 않은 사고가 있었다 - 버스트를 원천적으로
// 막는 게 목적이라 직렬화를 택함.
class KisRequestQueueImpl {

  private tail: Promise<void> = Promise.resolve();

  private lastDispatchAt: number | null = null;

  schedule<T>(env: KisEnvName, fn: () => Promise<T>): Promise<T> {
    const minIntervalMs = resolveMinIntervalMs(env);

    const turn = this.tail.then(async () => {
      if (this.lastDispatchAt !== null) {
        const waitMs = minIntervalMs - (Date.now() - this.lastDispatchAt);
        if (waitMs > 0) {
          await new Promise((resolve) => { setTimeout(resolve, waitMs); });
        }
      }
      this.lastDispatchAt = Date.now();
    });

    // 다음 호출자는 이 턴의 "대기 계산"이 끝나는 시점까지만 기다리면 된다 (fn 실행/응답까지
    // 기다릴 필요 없음) - 실패해도 체인이 끊기지 않도록 catch로 흡수.
    this.tail = turn.catch(() => undefined);

    return turn.then(fn);
  }

}

// env별 별도 페이싱을 위해 큐 자체를 env별로 하나씩 둔다.
const queues = new Map<KisEnvName, KisRequestQueueImpl>();

function getQueue(env: KisEnvName): KisRequestQueueImpl {
  let queue = queues.get(env);
  if (!queue) {
    queue = new KisRequestQueueImpl();
    queues.set(env, queue);
  }
  return queue;
}

export function scheduleKisRequest<T>(env: KisEnvName, fn: () => Promise<T>): Promise<T> {
  return getQueue(env).schedule(env, fn);
}
