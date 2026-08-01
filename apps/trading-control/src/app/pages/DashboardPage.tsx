import { Button, Flex, Text } from '@mint-ui/core';
import { useShowToastHook } from '@shared/ui/design-system-v1';
import styled from 'styled-components';

import { forceSell, getPositions, getStatus } from '../../api/client';
import { Position } from '../../api/types';
import { Card } from '../components/Card';
import { usePolling } from '../hooks/use-polling';

const Divider = styled.div`
  width: 100%;
  height: 1px;
  background: lightgray;
`;

function onOff(value: boolean) {
  return value ? 'ON' : 'OFF';
}

function isActiveState(state: Position['state']) {
  return state === 'checking' || state === 'watching_for_sell' || state === 'sell_waiting';
}

function StatusRow({ label, value }: { label: string; value: string; }) {
  return (
    <Flex rowDirection flexGap='8px' flexHeight='fit-content'>
      <Text text={label} color='gray' textWidth='90px' />
      <Text text={value} />
    </Flex>
  );
}

export function DashboardPage() {
  const setMessage = useShowToastHook();
  const { data: status } = usePolling(getStatus, 5000);
  const { data: positions, refresh: refreshPositions } = usePolling(getPositions, 5000);

  const handleForceSell = async (code: string) => {
    try {
      await forceSell(code);
      setMessage(`[${code}] 강제매도 요청 완료`);
      refreshPositions();
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  return (
    <Flex flexGap='16px' flexHeight='fit-content'>
      <Card flexGap='6px'>
        <Text text='서버 상태' size={16} weight={700} />
        {status ? (
          <>
            <StatusRow label='거래 모드' value={status.kisEnv ?? '(미설정)'} />
            <StatusRow
              label='세션'
              value={status.session ? `${status.session.date} / 개장일:${status.session.isBusinessDay ? 'Y' : 'N'}` : '오늘 세션 없음'}
            />
            <StatusRow label='스캐너' value={`거래대금:${onOff(status.scannerRunning)} VI:${onOff(status.viScannerRunning)} 갭:${onOff(status.gapScannerRunning)}`} />
            <StatusRow label='활성 포지션' value={`${status.activeWatcherCount}건`} />
          </>
        ) : <Text text='불러오는 중...' color='gray' />}
      </Card>

      <Card flexGap='10px'>
        <Text text='포지션' size={16} weight={700} />
        {!positions || positions.length === 0 ? (
          <Text text='오늘 매수 내역 없음' color='gray' />
        ) : positions.map((position) => (
          <Flex key={position.code} flexGap='4px' flexHeight='fit-content'>
            <Flex rowDirection justifyContent='space-between' alignItems='center' flexHeight='fit-content'>
              <Text text={`[${position.code}] ${position.name ?? ''} (${position.state})`} weight={600} />
              {isActiveState(position.state) && (
                <Button onClick={() => handleForceSell(position.code)}>강제매도</Button>
              )}
            </Flex>
            <Text text={`매수가:${position.buyPrice} 수량:${position.qty} 목표 high:${position.sellAmtHigh ?? '-'} low:${position.sellAmtLow ?? '-'}`} size={13} color='gray' />
            {position.stateMessage && <Text text={position.stateMessage} size={13} color='gray' whiteSpace='pre-line' />}
            <Divider />
          </Flex>
        ))}
      </Card>
    </Flex>
  );
}