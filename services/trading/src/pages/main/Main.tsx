import { Button, Flex, Grid, GridHeader } from '@mint-ui/core';
import { OrderCache, ResponseVolumeRank, VolumeRank } from '@shared/apis/kis';
import { useKisApi } from '@shared/hooks/api-hook';
import { OrderList } from '@shared/states/global';
import { ContentBox, PageContainer, Section } from '@shared/ui/design-system-v1';
import { DateUtil } from '@shared/utils/date';
import { useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';

import { MessageBox } from '../../components/MessageBox';
import { useIsOpenDay } from '../../hooks/is-open-day-hook';
import { SellByPercent } from '../../trading-strategy/sell-by-percent';
import { getOrderToday, isOrderedStock, removeOrderToday, removeOrderedStock, setOrderToday, setOrderedStock } from '../../utils/local-store';

const AMOUNT_REG_EXP = /\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g;

export function Main() {
  // 메시지
  const [ message, setMessage ] = useState({ content: '' });

  // 개장 여부
  const isOpen = useIsOpenDay();

  // 주문 리스트
  const [ orderList, setOrderList ] = useRecoilState(OrderList);
  const orderListRef = useRef([ orderList, setOrderList ] as [typeof orderList, typeof setOrderList]);
  useEffect(() => {
    orderListRef.current = [ orderList, setOrderList ];
  }, [ orderList ]);

  // 거래량 데이터
  const [ data, setData, refresh ] = useKisApi(VolumeRank, {
    request: {
      params: {
        FID_INPUT_PRICE_1: 2000,
        FID_INPUT_PRICE_2: 40000,
        FID_VOL_CNT: 1000000,
      },
    },
    callback(response) {
      if (autoCount.current < 0) {
        setMessage({ content: response?.msg1 || '' });
      } else {
        autoCount.current += 1;
        setMessage({ content: `자동조회중...${autoCount.current}` });

        const today = DateUtil.getToday();
        if (isOpen) {
          const [ orderList, setOrderList ] = orderListRef.current;
          const newOrder = { ...orderList };

          // 오늘 주문한 상태이면 종료
          if (getOrderToday()) {
            return;
          }

          // 오늘이 아니면 초기화
          if (today !== newOrder.date) {
            newOrder.date = today;
            newOrder.stocks = [];
            newOrder.trading = [];
            removeOrderToday();
            removeOrderedStock();
          }

          // 조건에 맞는 대상 종목 중 가장 위에것만 취하기
          const [ target ] = (response?.output || []).filter((item) => !isOrderedStock(item.mksc_shrn_iscd) && isTargetRow(item));
          if (target) {

            // 주문 리스트 갱신
            newOrder.stocks = [];
            newOrder.stocks.push(target.mksc_shrn_iscd);
            setOrderList({ ...newOrder });

            // 오늘의 주문 종목으로 기록
            setOrderedStock(target.mksc_shrn_iscd);

            // 오늘 주문 flag 처리
            setOrderToday();

            // 주문 API 처리 ( 주문수량 1개, 시장가(01) 매수 )
            OrderCache({
              body: {
                BUY: true, 
                PDNO: target.mksc_shrn_iscd,
                ORD_QTY: '1',
                ORD_DVSN: '01',
                ORD_UNPR: '0', 
              }, 
            }).then((res) => {

              // 주문 불가인 경우
              if (res.rt_cd !== '0') {

                // 메시지 처리
                const msg = `[${target.mksc_shrn_iscd} / ${target.hts_kor_isnm}] 주식주문불가??? => ${res.msg1}`;
                console.log(msg);
                setMessage({ content: msg });
                removeOrderToday();
                newOrder.stocks = [];
                setOrderList({ ...newOrder });

              } else { // 주문 성공인 경우

                // 메시지 처리
                const msg = `[${target.mksc_shrn_iscd} / ${target.hts_kor_isnm}] 주식주문완료!!! => ${res.output.ODNO}`;
                console.log(msg, res.output);
                setMessage({ content: msg });

                // 주문된 건으로 처리
                setOrderedStock(target.mksc_shrn_iscd);

                // 매매전략 실행
                newOrder.trading.push(new SellByPercent(target.mksc_shrn_iscd, 3, 4)); // 상위 3% 하위 -4% 매도 전략
                setOrderList({ ...newOrder });

              }
            });
          }
        }
      }
    },
  });

  // 작업/조회
  const autoCount = useRef(-1);
  const [ auto, setAuto ] = useState(false);
  const interval = useRef<number>();
  useEffect(() => {
    if (auto) {
      refresh();
      interval.current = window.setInterval(refresh, 2000);
    }
    return () => {
      window.clearInterval(interval.current);
      interval.current = undefined;
    };
  }, [ auto ]);

  // 버튼 핸들러
  const handleAutoModeClick = () => {
    if (!auto) {
      autoCount.current = 0;
    } else {
      autoCount.current = -1;
    }
    setMessage({ content: '' });
    setAuto(!auto);
  };

  const handleRefreshClick = () => {
    setData([]);
    refresh();
  };

  const handleWorkReset = () => {
    const [ orderList ] = orderListRef.current;
    if (orderList.trading.filter((trad) => trad.state !== 'done').length > 0) {
      setMessage({ content: '아직 처리중인 주문이 있습니다.' });
      return;
    }
    const today = DateUtil.getToday();
    removeOrderToday();
    setOrderList({ date: today, stocks: [], trading: [] });
  };

  // 그리드 포맷
  function amountFormat<T>(item:T, header:GridHeader<T>) {
    return String(item[header.targetId]).replace(AMOUNT_REG_EXP, ',');
  }
  function percentFormat<T>(item:T, header:GridHeader<T>) {
    return `${String(item[header.targetId])} %`;
  }
  function isTargetRow(item:ResponseVolumeRank) {
    const per = Number(item.prdy_ctrt);
    const inc = Number(item.vol_inrt);
    return per > 8 && inc > 100;
  }
  function targetRowClassName(item:ResponseVolumeRank) {
    return isTargetRow(item) ? 'mint-grid-target-row' : '';
  }
  function amountRedBlue(item:ResponseVolumeRank) {
    const per = Number(item.prdy_ctrt);
    if (per > 0) {
      return 'red';
    }
    if (per < 0) {
      return 'blue';
    }
    return undefined;
  }

  return (
    <PageContainer title='거래량 조회'>
      <ContentBox>
        <Section rowDirection flexAlign='center' flexSize='50px' justifyContent='space-between'>
          <Flex rowDirection flexAlign='center' flexGap='10px'>
            <Flex flexAlign='left-center'>{isOpen === undefined ? '' : `개장일:${isOpen}`}</Flex>
          </Flex>
          <Flex rowDirection flexSize='180px' flexAlign='right-center' flexGap='5px'>
            <Button onClick={handleWorkReset}>초기화</Button>
            <Button onClick={handleAutoModeClick}>{`작업 ${auto ? 'ON' : 'OFF'}`}</Button>
            <Button disabled={auto} onClick={handleRefreshClick}>조회</Button>
          </Flex>
        </Section>
        <Section rowDirection flexAlign='center' flexSize='50px' justifyContent='space-between'>
          <MessageBox message={message} clear={!auto} />
        </Section>
        <Section flexAlign='center'>
          <Flex>
            <Grid
              headers={[
                { label: '순위', targetId: 'data_rank', width: 40, textAlign: 'center' },
                { label: '종목', targetId: 'hts_kor_isnm', minWidth: 60, fontWeight: 700 },
                { label: '현재가', targetId: 'stck_prpr', minWidth: 55, textAlign: 'right', textFormat: amountFormat },
                { label: '등락율', targetId: 'prdy_ctrt', minWidth: 60, textAlign: 'right', textFormat: percentFormat, color: amountRedBlue },
                { label: '거래량', targetId: 'acml_vol', minWidth: 65, textAlign: 'right', textFormat: amountFormat },
                { label: '증가율', targetId: 'vol_inrt', minWidth: 68, textAlign: 'right', textFormat: percentFormat },
              ]}
              data={data || []}
              gridStyle={{ emptyText: 'No data', rowClassName: targetRowClassName }}
              rowHeightExtensible
            />
          </Flex>
        </Section>
      </ContentBox>
    </PageContainer>
  );
}