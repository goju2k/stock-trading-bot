import { Button, Flex, Table, Text } from '@mint-ui/core';
import { useShowToastHook } from '@shared/ui/design-system-v1';
import { useEffect, useState } from 'react';

import { getConfig, updateConfig } from '../../api/client';
import { TradingConfig } from '../../api/types';
import { Card } from '../components/Card';

export function ConfigPage() {
  const setMessage = useShowToastHook();
  const [ configState, setConfigState ] = useState<TradingConfig>();
  const [ saving, setSaving ] = useState(false);

  useEffect(() => {
    getConfig().then(setConfigState).catch((error) => setMessage((error as Error).message));
  }, []);

  if (!configState) {
    return <Text text='불러오는 중...' color='gray' />;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateConfig(configState);
      setConfigState(updated);
      setMessage('설정이 저장되었습니다.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Flex flexGap='16px' flexHeight='fit-content'>
      <Card flexGap='10px'>
        <Text text='매매 설정' size={16} weight={700} />
        <Table<TradingConfig>
          headers={[
            { label: '조회 주기 (ms)', targetId: 'refreshRateMs', formType: 'input', editable: true, maxLength: 6 },
            { label: '익절 (%)', targetId: 'highPercentage', formType: 'input', editable: true, maxLength: 4 },
            { label: '손절/트레일링폭 (%)', targetId: 'lowPercentage', formType: 'input', editable: true, maxLength: 4 },
            {
              label: '매도 전략',
              targetId: 'sellStrategy',
              formType: 'select',
              editable: true,
              item: [
                { label: '트레일링 (익절/손절 + quick_stop)', value: 'trailing' },
                { label: '틱다운 (매틱 하락시 즉시매도, +25% 도달시 즉시매도)', value: 'tick_down' },
              ],
            },
            { label: '매수 비율 (장시작 가용현금 대비 %, 최대)', targetId: 'orderAmtPercent', formType: 'input', editable: true, maxLength: 5 },
            { label: '매수 비율 (장시작 가용현금 대비 %, 최소 - 미달시 매수중단)', targetId: 'minOrderAmtPercent', formType: 'input', editable: true, maxLength: 5 },
            { label: '1건당 매수금액 상한 (원)', targetId: 'maxOrderAmt', formType: 'input', editable: true, maxLength: 9 },
            { label: '후보종목 가격 상한 (원)', targetId: 'maxCandidatePrice', formType: 'input', editable: true, maxLength: 8 },
            { label: '최소 종목가격 (원)', targetId: 'minTargetAmt', formType: 'input', editable: true, maxLength: 8 },
            { label: '최소 거래량', targetId: 'minTradingCount', formType: 'input', editable: true, maxLength: 10 },
            { label: '타겟 상승률 (%)', targetId: 'targetUpRating', formType: 'input', editable: true, maxLength: 4 },
            { label: '타겟 거래증가율 (%)', targetId: 'targetIncreaseRate', formType: 'input', editable: true, maxLength: 5 },
          ]}
          data={configState}
          setData={setConfigState}
          columnCountPerRow={1}
        />
      </Card>

      <Card flexGap='10px'>
        <Text text='전략 on/off' size={16} weight={700} />
        <Table<TradingConfig>
          headers={[
            { label: '자동매매 전체', targetId: 'autoTradingEnabled', formType: 'check', editable: true },
            { label: '외국인/기관 순매수 필터', targetId: 'requireForeignInstitutionNetBuy', formType: 'check', editable: true },
            { label: 'VI 해제 모멘텀 전략', targetId: 'viStrategyEnabled', formType: 'check', editable: true },
            { label: '시가 갭 상승 전략', targetId: 'gapStrategyEnabled', formType: 'check', editable: true },
          ]}
          data={configState}
          setData={setConfigState}
          columnCountPerRow={1}
        />
      </Card>

      <Card flexGap='10px'>
        <Text text='시가 갭 상승 전략 설정' size={16} weight={700} />
        <Table<TradingConfig>
          headers={[
            { label: '갭 임계값 (%)', targetId: 'gapUpThresholdPercent', formType: 'input', editable: true, maxLength: 4 },
            { label: '스캔 지속 시간 (분)', targetId: 'gapScanWindowMinutes', formType: 'input', editable: true, maxLength: 3 },
          ]}
          data={configState}
          setData={setConfigState}
          columnCountPerRow={1}
        />
      </Card>

      <Flex rowDirection justifyContent='flex-end' flexHeight='fit-content'>
        <Button disabled={saving} onClick={handleSave}>{saving ? '저장 중...' : '설정 저장'}</Button>
      </Flex>
    </Flex>
  );
}