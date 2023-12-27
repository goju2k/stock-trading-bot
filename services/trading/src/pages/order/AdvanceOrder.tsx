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
            <Flex flexSize='160px'>
              <Text text='앱 설정' size={16} weight={700} />
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
            </Flex>
            <Flex flexSize='160px'>
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