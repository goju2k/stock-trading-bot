import { OrderCache, VolumeRank } from '@shared/apis/kis';
import { useKisApi } from '@shared/hooks/api-hook';
import { useStateRef } from '@shared/hooks/util-hook';
import { AppConfig, OrderDate, OrderListStore, OrderStocks, OrderTrading, PassedList, getOrderToday, removeOrderToday, useAddPassedList } from '@shared/states/global';
import { useShowToastHook } from '@shared/ui/design-system-v1';
import { DateUtil } from '@shared/utils/date';
import { useEffect, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

import { useIsOpenDay } from './is-open-day-hook';

import { useIsTargetRow } from '../pages/main/hooks/is-target-row';
import { SellByPercent } from '../trading-strategy/sell-by-percent';

export function useKisCatchStock(autoBuying:boolean, onNotWorkingCondition?:()=>void) {

  // toast message
  const setMessage = useShowToastHook();

  // 앱 설정
  const appConfig = useRecoilValue(AppConfig);
  
  // 주문 리스트
  const [ orderDate, setOrderDate ] = useRecoilState(OrderDate);
  const orderDateRef = useStateRef(orderDate);

  const [ orderStocks, setOrderStocks ] = useRecoilState(OrderStocks);
  const orderStocksRef = useStateRef(orderStocks);

  const [ orderTrading, setOrderTrading ] = useRecoilState(OrderTrading);
  const orderTradingRef = useStateRef(orderTrading);

  // 개장 여부
  const { isOpen } = useIsOpenDay();
  const isOpenRef = useStateRef(isOpen);
  
  // auto count
  const autoCount = useRef(-1);
  useEffect(() => {
    if (autoBuying) {
      autoCount.current = 0;
      refresh();
      reFetch();
    } else {
      autoCount.current = -1;
    }
  }, [ autoBuying ]);

  // 체크 반복 처리
  const reFetch = () => {
    setTimeout(() => {
      refresh();
      if (autoCount.current >= 0) {
        reFetch();
      }
    }, appConfig.refreshRate);
  };

  // 매수 대상 여부
  const isTargetRow = useIsTargetRow();

  // 제외 처리
  const passedList = useRecoilValue(PassedList);
  const addPassedList = useAddPassedList();

  // 거래량 데이터 fetch
  const [ data, setData, refresh ] = useKisApi(VolumeRank, {
    request: {
      params: {
        FID_INPUT_PRICE_1: appConfig.minTargetAmt || 4000,
        FID_INPUT_PRICE_2: appConfig.maxOrderAmt || 40000,
        FID_VOL_CNT: appConfig.minTradingCount || 1000000,
      },
    },
    callback(response) {
      if (autoCount.current < 0) {
        setMessage(response!.msg1);
      } else {
        autoCount.current += 1;
        setMessage(`자동조회중...${autoCount.current}`);
        const today = DateUtil.getToday();
        const todayHHMi = DateUtil.getTodayHHMi();
        
        // 개장일이고 처리시간 내이면
        if (isOpenRef.current === 'Y'
        && appConfig.workingStart <= todayHHMi 
        && appConfig.workingEnd >= todayHHMi
        ) {

          let orderDate = orderDateRef.current;
          let orderStocks = orderStocksRef.current;
          let orderTrading = orderTradingRef.current;

          // 오늘 주문한 상태이면 현재 조회 대상들은 모두 pass 대상으로 처리
          // (주문을 처리중인 상태에서 조회된 다른 종목들은 상품가치가 떨어짐. 새로 튀는것을 잡아야함)
          if (getOrderToday()) {
            const currList = (response?.output || []).map((item) => item.mksc_shrn_iscd);
            addPassedList(currList);
            return;
          }

          // 오늘이 아니면 초기화
          if (today !== orderDate) {
            orderDate = today;
            orderStocks = [];
            orderTrading = [];
            setOrderDate(orderDate);
            setOrderStocks(orderStocks);
            setOrderTrading(orderTrading);
            removeOrderToday();
            OrderListStore.removeAll();
            // PassedListStore.removeAll();
          }

          // 조건에 맞는 대상 종목 중 가장 위에것만 취하기 (1건씩만)
          const [ target ] = (response?.output || []).filter((item) => !OrderListStore.includes(item.mksc_shrn_iscd) // 오늘 주문 아니고
          && !passedList.includes(item.mksc_shrn_iscd) // Pass 대상도 아니고
          && isTargetRow(item)); // 타겟 종목일때

          if (target) {

            // 주문 리스트 갱신
            orderStocks = [ ...orderStocks ];
            orderStocks.push(target.mksc_shrn_iscd);
            setOrderStocks(orderStocks);

            // 오늘의 주문 종목으로 기록
            OrderListStore.set(target.mksc_shrn_iscd);

            // pass list 에 set
            addPassedList(target.mksc_shrn_iscd);

            // 오늘 주문 flag 처리
            //  => 여러개의 주문을 처리하기 위해 더이상 주문을 막지 않는다.
            // setOrderToday();

            // 주문 API 처리 ( 시장가(01) 매수 )
            // 주문 수량
            const maxAmt = appConfig.maxOrderAmt;
            const orderCount = (maxAmt / Number(target.stck_prpr)).toFixed(0);
            if (Number(orderCount) <= 0) { // 신청 불가하면 pass
              setMessage(`최대 주문금액 (${maxAmt}) 을 초과합니다.`);
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
                setMessage(msg);
                
              } else { // 주문 성공인 경우

                // 메시지 처리
                const msg = `[${target.mksc_shrn_iscd} / ${target.hts_kor_isnm}] 주식주문완료!!! => ${res.output.ODNO} ${orderCount}주`;
                console.log(msg, res.output);
                setMessage(msg);

                // 매매전략 실행
                const callback = () => {
                  // newOrder.trading.splice(newOrder.trading.indexOf(trad), 1); => 제거는 하지 말자
                  setOrderTrading([ ...orderTradingRef.current ]);
                };

                const trad = new SellByPercent(target.mksc_shrn_iscd, appConfig.highPercentage, appConfig.lowPercentage, callback);
                setOrderTrading([ ...orderTradingRef.current, trad ]);

              }
            });
          }
          
          // 한번 조회된것은 모두 제외 (처음 리스트업 되는 매물만 잡기!!!)
          
          addPassedList((response?.output || []).map((item) => item.mksc_shrn_iscd));

        } else {

          onNotWorkingCondition && onNotWorkingCondition();
          
        }
      }
    },
  });

  return { data, setData, refresh };
}