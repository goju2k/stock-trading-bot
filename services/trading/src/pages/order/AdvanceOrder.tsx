import { Button, Flex, Table, Text } from '@mint-ui/core';
import { AppConfig } from '@shared/states/global';
import { ContentBox, FlexRight, PageContainer, Section } from '@shared/ui/design-system-v1';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

export function AdvanceOrder() {

  const [ config, setConfig ] = useRecoilState(AppConfig);
  useEffect(() => {
    setConfigState({ ...config });
  }, [ config ]);

  const [ configState, setConfigState ] = useState({ ...config });
  
  return (
    <PageContainer title='주문설정'>
      <ContentBox>
        <Section>
          <Flex flexGap='20px'>
            <Flex flexSize='fit-content'>
              <Text text='작업 설정' size={16} weight={700} />
              <Table
                headers={[
                  { label: '새로고침 시간(ms)', targetId: 'refreshRate', formType: 'input', editable: true, maxLength: 4 },
                  { label: '작업 시작시간(hhmm)', targetId: 'workingStart', formType: 'input', editable: true, maxLength: 4 },
                  { label: '작업 종료시간(hhmm)', targetId: 'workingEnd', formType: 'input', editable: true, maxLength: 4 },
                ]}
                data={configState}
                setData={setConfigState}
                columnCountPerRow={1}
              />
              <Text text={`작업시간은 ${configState.workingStart} 부터 ${configState.workingEnd} 까지 ${configState.refreshRate} ms 시간 간격으로 타겟을 찾습니다.`} whiteSpace='pre-line' />
            </Flex>
            <Flex flexSize='fit-content'>
              <Text text='타겟 설정' size={16} weight={700} />
              <Table
                headers={[
                  { label: '주식 최소금액 (원)', targetId: 'minTargetAmt', formType: 'input', editable: true, maxLength: 6 },
                  { label: '최소거래량 (건수)', targetId: 'minTradingCount', formType: 'input', editable: true, maxLength: 8 },
                  { label: '타겟 거래증가율 (%)', targetId: 'targetIncreaseRate', formType: 'input', editable: true, maxLength: 6 },
                  { label: '타겟 상승률 (%)', targetId: 'targetUpRating', formType: 'input', editable: true, maxLength: 2 },
                ]} 
                data={configState}
                setData={setConfigState}
                columnCountPerRow={1}
              />
              <Text text={`1주당 가격이 ${configState.minTargetAmt} 원 ~ ${configState.maxOrderAmt} 원 내의 종목중에 거래량이 ${configState.minTradingCount} 건 이상이고 거래증가율이 ${configState.targetIncreaseRate} % 이상이면서 주가상승률이 ${configState.targetUpRating} % 이상인 건이 매수 대상입니다.`} whiteSpace='pre-line' />
            </Flex>
            <Flex flexSize='fit-content'>
              <Text text='매매 설정' size={16} weight={700} />
              <Table
                headers={[
                  { label: '최대 매수금액 (원)', targetId: 'maxOrderAmt', formType: 'input', editable: true, maxLength: 6 },
                  { label: '상위 매도 값 (%)', targetId: 'highPercentage', formType: 'input', editable: true, maxLength: 2 },
                  { label: '하위 매도 값 (%)', targetId: 'lowPercentage', formType: 'input', editable: true, maxLength: 2 },
                ]} 
                data={configState}
                setData={setConfigState}
                columnCountPerRow={1}
              />
              <Text text={`타겟 1종목당 매수 최대금액은 ${configState.maxOrderAmt} 원 이고 주가가 ${configState.highPercentage} % 이상 오르면 익절 / -${configState.lowPercentage} % 이하로 떨어지면 손절합니다. `} whiteSpace='pre-line' />
            </Flex>
            <FlexRight flexSize='50px'>
              <Button onClick={() => {
                setConfig(configState);
              }}
              >설정 저장
              </Button>
            </FlexRight>
          </Flex>
        </Section>
      </ContentBox>
    </PageContainer>
  );
}