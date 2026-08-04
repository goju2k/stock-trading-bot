import { Prisma, TradeEventType } from '@prisma/client';

import { getPrisma } from '../lib/prisma';
import { DISCORD_COLOR, sendDiscordMessage } from '../notify/discord';

export interface LogTradeEventInput {
  sessionId?: number | null;
  type: TradeEventType;
  code?: string | null;
  // 디스코드 알림에 종목명을 같이 보여주기 위한 값 - TradeEvent 테이블엔 name 컬럼이 없어서
  // (Order.name이 원본) DB에는 안 쓰고 알림 포맷팅에만 쓴다.
  name?: string | null;
  message: string;
  payload?: Prisma.InputJsonValue | null;
  // 기본 true - false면 알림 대상 타입이어도 디스코드로는 안 보내고 DB에만 기록한다. 같은
  // 종류의 이벤트가 한꺼번에 몰릴 때(예: 장 시작시 잔여 포지션 일괄 정리) 개별 알림 대신
  // 호출부에서 요약 메시지 하나로 묶어 보내기 위함.
  notify?: boolean;
}

// 매수/매도 체결, 세션 시작·종료, 그리고 매도/에러성 실패까지 디스코드로 알림.
// 2026-08-02 사고(레이트리밋으로 매도 예외 발생 → sell_failed/error가 기록만 되고 알림이
// 안 나가서 방치된 채로 몇 시간 동안 아무도 몰랐음) 이후로 sell_failed/error를 알림 대상에
// 추가했다. buy_failed는 매매불가 종목 거부처럼 흔히 발생하는 정상 케이스가 섞여있어 아직
// 알림 대상에서 제외 (필요해지면 여기에 추가).
const EVENT_NOTIFICATION: Partial<Record<TradeEventType, { title: string; color: number; }>> = {
  session_start: { title: '🔔 장 시작', color: DISCORD_COLOR.cyan },
  session_end: { title: '🔔 장 종료', color: DISCORD_COLOR.yellow },
  buy_executed: { title: '🟢 매수 체결', color: DISCORD_COLOR.green },
  sell_executed: { title: '🔵 매도 체결', color: DISCORD_COLOR.blue },
  forced_liquidation: { title: '🔵 강제청산 매도', color: DISCORD_COLOR.blue },
  sell_failed: { title: '🔴 매도 실패', color: DISCORD_COLOR.red },
  error: { title: '🔴 에러', color: DISCORD_COLOR.red },
};

// TradeEvent DB 기록 + (알림 대상 타입이면) 디스코드 발송까지 처리하는 단일 통로.
// 매매 로직 곳곳에서 직접 prisma.tradeEvent.create()를 호출하면 알림을 빠뜨리기 쉬워서
// 이 함수 하나로 몰았다.
export async function logTradeEvent(input: LogTradeEventInput) {
  const { name, notify = true, ...eventData } = input;
  const event = await getPrisma().tradeEvent.create({ data: eventData });

  const notification = EVENT_NOTIFICATION[input.type];
  if (notification && notify) {
    const label = input.code ? (name ? `${name}(${input.code})` : input.code) : null;
    await sendDiscordMessage({
      title: notification.title,
      description: label ? `[${label}] ${input.message}` : input.message,
      color: notification.color,
    });
  }

  return event;
}