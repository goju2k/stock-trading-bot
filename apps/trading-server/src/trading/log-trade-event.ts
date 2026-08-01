import { Prisma, TradeEventType } from '@prisma/client';

import { getPrisma } from '../lib/prisma';
import { DISCORD_COLOR, sendDiscordMessage } from '../notify/discord';

export interface LogTradeEventInput {
  sessionId?: number | null;
  type: TradeEventType;
  code?: string | null;
  message: string;
  payload?: Prisma.InputJsonValue | null;
}

// 매수/매도 체결과 세션 시작·종료만 디스코드로 알림. buy_failed/sell_failed/error는
// 지금은 DB 기록만 하고 알림은 보내지 않는다 (요청 범위 밖 - 필요해지면 여기에 추가).
const EVENT_NOTIFICATION: Partial<Record<TradeEventType, { title: string; color: number; }>> = {
  session_start: { title: '🔔 장 시작', color: DISCORD_COLOR.cyan },
  session_end: { title: '🔔 장 종료', color: DISCORD_COLOR.yellow },
  buy_executed: { title: '🟢 매수 체결', color: DISCORD_COLOR.green },
  sell_executed: { title: '🔵 매도 체결', color: DISCORD_COLOR.blue },
  forced_liquidation: { title: '🔵 강제청산 매도', color: DISCORD_COLOR.blue },
};

// TradeEvent DB 기록 + (알림 대상 타입이면) 디스코드 발송까지 처리하는 단일 통로.
// 매매 로직 곳곳에서 직접 prisma.tradeEvent.create()를 호출하면 알림을 빠뜨리기 쉬워서
// 이 함수 하나로 몰았다.
export async function logTradeEvent(input: LogTradeEventInput) {
  const event = await getPrisma().tradeEvent.create({ data: input });

  const notification = EVENT_NOTIFICATION[input.type];
  if (notification) {
    await sendDiscordMessage({
      title: notification.title,
      description: input.code ? `[${input.code}] ${input.message}` : input.message,
      color: notification.color,
    });
  }

  return event;
}