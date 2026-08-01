import { Flex, Text } from '@mint-ui/core';
import styled from 'styled-components';

import { getEvents } from '../../api/client';
import { TradeEventType } from '../../api/types';
import { usePolling } from '../hooks/use-polling';

const Divider = styled.div`
  width: 100%;
  height: 1px;
  background: lightgray;
`;

const TYPE_LABEL: Record<TradeEventType, string> = {
  session_start: '세션시작',
  session_end: '세션종료',
  buy_executed: '매수체결',
  buy_failed: '매수실패',
  sell_executed: '매도체결',
  sell_failed: '매도실패',
  forced_liquidation: '강제청산',
  error: '에러',
};

export function LogsPage() {
  const { data: events } = usePolling(() => getEvents(100), 5000);

  return (
    <Flex flexGap='6px' flexHeight='fit-content'>
      <Text text='이벤트 로그' size={16} weight={700} />
      {!events || events.length === 0 ? (
        <Text text='이벤트 없음' color='gray' />
      ) : events.map((event) => (
        <Flex key={event.id} flexGap='2px' flexHeight='fit-content'>
          <Flex rowDirection flexGap='8px' flexHeight='fit-content'>
            <Text text={new Date(event.createdAt).toLocaleString('ko-KR')} size={12} color='gray' textWidth='150px' />
            <Text text={TYPE_LABEL[event.type] ?? event.type} size={13} weight={600} />
            {event.code && <Text text={`[${event.code}]`} size={13} color='gray' />}
          </Flex>
          <Text text={event.message} size={13} whiteSpace='pre-line' />
          <Divider />
        </Flex>
      ))}
    </Flex>
  );
}