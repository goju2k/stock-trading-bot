import { Button, Flex, Grid, GridHeader, LineChart, Text } from '@mint-ui/core';
import { OrderCache, ResponseVolumeRank, VolumeRank } from '@shared/apis/kis';
import { useKisApi } from '@shared/hooks/api-hook';
import { AppConfig, OrderList, OrderListStore, PassedListStore, getOrderToday, removeOrderToday } from '@shared/states/global';
import { ContentBox, PageContainer, Section } from '@shared/ui/design-system-v1';
import { DateUtil } from '@shared/utils/date';
import { useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

import { MessageBox } from '../../components/MessageBox';
import { useIsOpenDay } from '../../hooks/is-open-day-hook';
import { SellByPercent } from '../../trading-strategy/sell-by-percent';

const AMOUNT_REG_EXP = /\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g;

export function Main() {
  // 메시지
  const [ message, setMessage ] = useState({ content: '' });

  // 앱 설정
  const appConfig = useRecoilValue(AppConfig);

  // 개장 여부
  const { isOpen, checkOpenDay } = useIsOpenDay();
  const isOpenRef = useRef<string>();
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [ isOpen ]);

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
        const todayHHMi = DateUtil.getTodayHHMi();
        
        // 개장일이고 처리시간 내이면
        if (isOpenRef.current === 'Y'
        && appConfig.workingStart <= todayHHMi 
        && appConfig.workingEnd >= todayHHMi
        ) {

          const [ orderList, setOrderList ] = orderListRef.current;
          const newOrder = { ...orderList };

          // 오늘 주문한 상태이면 현재 조회 대상들은 모두 pass 대상으로 처리
          // (주문을 처리중인 상태에서 조회된 다른 종목들은 상품가치가 떨어짐. 새로 튀는것을 잡아야함)
          if (getOrderToday()) {
            const currList = (response?.output || []).map((item) => item.mksc_shrn_iscd);
            PassedListStore.setAll(currList);
            return;
          }

          // 오늘이 아니면 초기화
          if (today !== newOrder.date) {
            newOrder.date = today;
            newOrder.stocks = [];
            newOrder.trading = [];
            removeOrderToday();
            OrderListStore.removeAll();
            // PassedListStore.removeAll();
          }

          // 조건에 맞는 대상 종목 중 가장 위에것만 취하기 (1건씩만)
          const [ target ] = (response?.output || []).filter((item) => !OrderListStore.includes(item.mksc_shrn_iscd) // 오늘 주문 아니고
          && !PassedListStore.includes(item.mksc_shrn_iscd) // Pass 대상도 아니고
          && isTargetRow(item)); // 타겟 종목일때

          if (target) {

            // 주문 리스트 갱신
            newOrder.stocks = [ ...newOrder.stocks ];
            newOrder.stocks.push(target.mksc_shrn_iscd);
            setOrderList({ ...newOrder });
            PassedListStore.set(target.mksc_shrn_iscd);

            // 오늘의 주문 종목으로 기록
            OrderListStore.set(target.mksc_shrn_iscd);

            // 오늘 주문 flag 처리
            //  => 여러개의 주문을 처리하기 위해 더이상 주문을 막지 않는다.
            // setOrderToday();

            // 주문 API 처리 ( 시장가(01) 매수 )
            // 주문 수량
            const maxAmt = appConfig.maxOrderAmt;
            const orderCount = (maxAmt / Number(target.stck_prpr)).toFixed(0);
            if (Number(orderCount) <= 0) { // 신청 불가하면 pass
              setMessage({ content: `최대 주문금액 (${maxAmt}) 을 초과합니다.` });
              return;
            }

            OrderCache({
              body: {
                BUY: true, 
                PDNO: target.mksc_shrn_iscd,
                ORD_QTY: orderCount,
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
                
              } else { // 주문 성공인 경우

                // 메시지 처리
                const msg = `[${target.mksc_shrn_iscd} / ${target.hts_kor_isnm}] 주식주문완료!!! => ${res.output.ODNO} ${orderCount}주`;
                console.log(msg, res.output);
                setMessage({ content: msg });

                // 매매전략 실행
                newOrder.trading = [ ...newOrder.trading ];
                
                const callback = () => {
                  const [ orderList, setOrderList ] = orderListRef.current;
                  // newOrder.trading.splice(newOrder.trading.indexOf(trad), 1); => 제거는 하지 말자
                  orderList.trading = [ ...orderList.trading ];
                  setOrderList({ ...orderList });
                };

                const trad = new SellByPercent(target.mksc_shrn_iscd, appConfig.highPercentage, appConfig.lowPercentage, callback);
                newOrder.trading.push(trad);
                setOrderList({ ...newOrder });

              }
            });
          }
        } else {
          handleAutoModeClick();
          setMessage({
            content: isOpenRef.current !== 'Y' 
              ? '개장일이 아닙니다' 
              : `작업 가능시간이 아닙니다. (${appConfig.workingStart} ~ ${appConfig.workingEnd})`, 
          });
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
      checkOpenDay(); // 개장일 다시 체크
      refresh();
      interval.current = window.setInterval(refresh, appConfig.refreshRate);
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
    OrderListStore.removeAll();
    setMessage({ content: '주문내역이 초기화되었습니다.' });
  };

  const handleExcludeClick = () => {
    const currList = (data || []).map((item) => item.mksc_shrn_iscd);
    PassedListStore.setAll(currList);
  };

  // 그리드 포맷
  function amountFormat<T>(item:T, header:GridHeader<T>) {
    return String(item[header.targetId]).replace(AMOUNT_REG_EXP, ',');
  }
  function percentFixedFormat<T>(item:T, header:GridHeader<T>) {
    const val = Number(item[header.targetId]);
    return `${(val > 9999 ? '9999' : val.toFixed(0)).replace(AMOUNT_REG_EXP, ',')} %`;
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
    const [ orderList ] = orderListRef.current;
    if (orderList.trading.filter((trad) => trad.code === item.mksc_shrn_iscd 
    && trad.state !== 'done' 
    && trad.state !== 'error').length > 0) {
      return 'mint-grid-processing-row';
    }
    if (orderList.stocks.includes(item.mksc_shrn_iscd)) {
      return 'mint-grid-ordered-row';
    }
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
          <Flex rowDirection flexSize='270px' flexAlign='right-center' flexGap='5px'>
            <Button onClick={handleWorkReset}>초기화</Button>
            <Button onClick={handleAutoModeClick}>{`작업 ${auto ? 'ON' : 'OFF'}`}</Button>
            <Button disabled={auto} onClick={handleRefreshClick}>조회</Button>
            <Button onClick={handleExcludeClick}>제외처리</Button>
          </Flex>
        </Section>
        <Section rowDirection flexAlign='center' flexSize='50px' justifyContent='space-between'>
          <MessageBox message={message} clear={!auto} />
        </Section>
        <Section flexAlign='center' flexPadding='10px 0px'>
          <Flex>
            <Grid
              headers={[
                { label: '순위', targetId: 'data_rank', width: 40, textAlign: 'center' },
                { label: '종목', targetId: 'hts_kor_isnm', minWidth: 60, fontWeight: 700 },
                { label: '현재가', targetId: 'stck_prpr', minWidth: 50, textAlign: 'right', textFormat: amountFormat },
                { label: '등락율', targetId: 'prdy_ctrt', minWidth: 55, textAlign: 'right', textFormat: percentFormat, color: amountRedBlue },
                { label: '거래량', targetId: 'acml_vol', minWidth: 65, textAlign: 'right', textFormat: amountFormat },
                { label: '증가율', targetId: 'vol_inrt', minWidth: 55, textAlign: 'right', textFormat: percentFixedFormat },
              ]}
              data={data || []}
              gridStyle={{ emptyText: 'No data', rowClassName: targetRowClassName }}
              rowHeightExtensible
            />
          </Flex>
        </Section>
        <Section flexSize='180px'>
          {data && data.length > 0 ? (
            <LineChart
              data={data.filter((item) => Number(item.prdy_ctrt) > 0).map(
                (item, idx) => ({
                  ...item,
                  data_rank: idx + 1,
                }),
              ).slice(0, 15)}
              series={[{
                type: 'PointAndFill', 
                keyY: 'prdy_ctrt',
                lineStyle: { fill: 'lightgreen', fillOpacity: 0.6, stroke: 'lightgreen', strokeWidth: 2 }, 
                pointStyle: { pointSize: 2 },
              }]}
              seriesConfig={{
                keyX: 'data_rank',
                valueUnit: 6, 
                labelY: { renderer: (val) => `${val}%` },
                minValue: 0,
                maxValue: 30,
              }}
              paddingTop={30}
              paddingBottom={30}
              paddingLeft={35}
              paddingRight={10}
            />
          )
            : <Flex flexAlign='center'><Text text='No Data' /></Flex>}
        </Section>
      </ContentBox>
    </PageContainer>
  );
}