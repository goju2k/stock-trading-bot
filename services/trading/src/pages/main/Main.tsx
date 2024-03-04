import { Button, Flex } from '@mint-ui/core';
import { useStateRef } from '@shared/hooks/util-hook';
import { AppConfig, OrderDate, OrderListStore, OrderStocks, OrderTrading, PassedList, removeOrderToday } from '@shared/states/global';
import { ContentBox, PageContainer, Section, useShowToastHook } from '@shared/ui/design-system-v1';
import { DateUtil } from '@shared/utils/date';
import { useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

import { MainChart } from './components/MainChart';
import { MainGrid } from './components/MainGrid';

import { useIsOpenDay } from '../../hooks/is-open-day-hook';
import { useKisCatchStock } from '../../hooks/kis-catch-stock-hook';

export function Main() {

  // 메시지
  const setMessage = useShowToastHook();

  // 개장일 여부
  const { isOpen } = useIsOpenDay();
  const isOpenRef = useStateRef(isOpen);

  // 앱 설정
  const appConfig = useRecoilValue(AppConfig);

  // 처리 모드
  const [ auto, setAuto ] = useState(false);

  // KIS 자동매수 처리
  const { data, setData, refresh } = useKisCatchStock(auto, () => {
    handleAutoModeClick();
    setMessage(isOpenRef.current !== 'Y' 
      ? '개장일이 아닙니다' 
      : `작업 가능시간이 아닙니다. (${appConfig.workingStart} ~ ${appConfig.workingEnd})`);
  });

  // 주문 리스트
  const setOrderDate = useSetRecoilState(OrderDate);
  
  const [ orderTrading, setOrderTrading ] = useRecoilState(OrderTrading);
  const orderTradingRef = useStateRef(orderTrading);

  const setOrderStocks = useSetRecoilState(OrderStocks);

  // 버튼 핸들러: 작업 on/off
  const handleAutoModeClick = () => {
    setAuto(!auto);
  };

  // 버튼 핸들러: 조회(새로고침)
  const handleRefreshClick = () => {
    setData([]);
    refresh();
  };

  // 버튼 핸들러: 초기화
  const handleWorkReset = () => {
    
    if (orderTradingRef.current.filter((trad) => trad.state !== 'done').length > 0) {
      setMessage('아직 처리중인 주문이 있습니다.');
      return;
    }

    const today = DateUtil.getToday();
    removeOrderToday();

    setOrderDate(today);
    setOrderStocks([]);
    setOrderTrading([]);
    
    OrderListStore.removeAll();

    setMessage('주문내역이 초기화되었습니다.');

  };

  // 버튼 핸들러: 제외처리
  const setPassedList = useSetRecoilState(PassedList);
  const handleExcludeClick = () => {
    const currList = (data || []).map((item) => item.mksc_shrn_iscd);
    setPassedList(currList);
    setMessage(currList.length > 0 ? `${currList.length} 건 제외처리 되었습니다.` : '제외할 대상이 없습니다.');
  };

  return (
    <PageContainer title='거래량 조회'>

      <ContentBox>

        <Section rowDirection flexAlign='center' flexSize='50px' justifyContent='space-between'>
          <Flex rowDirection flexAlign='center' flexGap='10px'>
            <Flex flexAlign='left-center'>{isOpen === undefined ? '' : `개장일:${isOpen}`}</Flex>
          </Flex>
          <Flex rowDirection flexSize='270px' flexAlign='right-center' flexGap='5px'>
            <Button onClick={handleWorkReset}>초기화</Button>
            <Button onClick={handleAutoModeClick}>{`작업 ${auto ? 'ON' : 'OFF'}`}</Button>
            <Button disabled={auto} onClick={handleRefreshClick}>조회</Button>
            <Button onClick={handleExcludeClick}>제외처리</Button>
          </Flex>
        </Section>

        <Section flexAlign='center' flexPadding='10px 0px'>
          <Flex>
            <MainGrid data={data || []} />
          </Flex>
        </Section>

        <Section flexSize='180px'>
          <MainChart data={data} />
        </Section>

      </ContentBox>

    </PageContainer>
  );
}