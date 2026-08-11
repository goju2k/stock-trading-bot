import { PositionWatcher } from './position-watcher';

import { getPrisma } from '../lib/prisma';

// 현재 프로세스에서 살아있는 PositionWatcher 인스턴스 레지스트리 (code -> watcher).
// BalancePoller 리스너는 인메모리 클로저라서 DB만으로는 재현이 안 되고,
// 서버가 떠 있는 동안 이 맵으로 추적하다가 재시작 시 resumeOpenWatchers()로 복구한다.
class TradingRuntimeImpl {

  private watchers = new Map<string, PositionWatcher>();

  add(watcher: PositionWatcher) {
    this.watchers.set(watcher.code, watcher);
  }

  remove(code: string) {
    this.watchers.delete(code);
  }

  all() {
    return Array.from(this.watchers.values());
  }

  active() {
    return this.all().filter((w) => w.state !== 'done' && w.state !== 'error');
  }

}

export const TradingRuntime = new TradingRuntimeImpl();

// 서버 재시작 후 오늘 세션의 미종료 position_watchers를 복구해서 BalancePoller 리스너를 재등록.
export async function resumeOpenWatchers(sessionId: number) {
  const rows = await getPrisma().positionWatcher.findMany({
    where: {
      state: { notIn: [ 'done', 'error' ] },
      order: { sessionId },
    },
    include: { order: { select: { name: true, orderedAt: true } } },
  });

  rows.forEach((row) => {
    const watcher = PositionWatcher.resume(row, sessionId, row.order.name, row.order.orderedAt, (w) => TradingRuntime.remove(w.code));
    TradingRuntime.add(watcher);
  });

  if (rows.length > 0) {
    console.log(`[runtime] resumed ${rows.length} open position watcher(s)`);
  }
}