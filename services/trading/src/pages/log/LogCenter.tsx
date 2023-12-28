import { Flex, LineChart, Text } from '@mint-ui/core';
import { CheckBalance, CheckBalanceListener } from '@shared/apis/kis';
import { OrderList } from '@shared/states/global';
import { ContentBox, FlexLeft, PageContainer } from '@shared/ui/design-system-v1';
import { DateUtil } from '@shared/utils/date';
import { useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';

interface LogData {
  code:string;
  name:string;
  amt:string;
  currAmt:string;
  targetAmtHigh:number;
  targetAmtLow:number;
  data:LogSeries[];
}

interface LogSeries {
  time:number;
  currAmt:number;
  targetAmtHigh:number;
  targetAmtLow:number;
}

const getContainerSize = () => Math.min(window.screen.width, 700);
const getXCountPerWidth = () => Math.floor(getContainerSize() / 50);

export function LogCenter() {
  
  // balance data
  const [ balanceData, setBalanceData ] = useState<LogData[]>([]);
  const balanceDataRef = useRef(balanceData);
  useEffect(() => {
    balanceDataRef.current = balanceData;
  }, [ balanceData ]);

  // 잔고조회 listener
  const checkRef = useRef<CheckBalanceListener>((data) => {

    const hhmi = Number(DateUtil.getTodayHHMiSS());
    
    const xCountPerWidth = getXCountPerWidth();

    const newBalanceData:typeof balanceData = [];
    orderListRef.current.forEach((trad) => {
      
      // 기존 data 있는지 체크
      let [ prev ] = balanceDataRef.current.filter((bal) => bal.code === trad.code);
      if (!prev) {
        prev = {
          code: trad.code,
          name: '',
          amt: '0',
          currAmt: '0', 
          targetAmtHigh: trad.sellAmtHigh,
          targetAmtLow: trad.sellAmtLow,
          data: [], 
        };
      }

      // 잔고 조회 데이터 추가
      const [ filtered ] = data.filter((item) => item.pdno === prev.code && Number(item.hldg_qty) > 0);
      if (filtered) {
        prev.data.push({
          time: hhmi,
          currAmt: Number(filtered.prpr),
          targetAmtHigh: trad.sellAmtHigh,
          targetAmtLow: trad.sellAmtLow,
        });
        prev.name = filtered.prdt_name;
        prev.amt = Number(filtered.pchs_avg_pric).toFixed(0);
        prev.currAmt = filtered.prpr;
      }

      // 해상도에 비례해서 넘치면 앞에서 자르기
      if (prev.data.length > xCountPerWidth) {
        prev.data.splice(0, prev.data.length - xCountPerWidth);
      }

      newBalanceData.push(prev);

    });

    setBalanceData(newBalanceData);

  });
    
  // 주문 리스트
  const [ orderList ] = useRecoilState(OrderList);
  const orderListRef = useRef(orderList.trading);
  useEffect(() => {

    orderListRef.current = orderList.trading;

    // 잔고조회 listener add / remove
    const filters = orderList.trading.filter((trad) => trad.state === 'watching-for-sell');
    if (filters.length > 0) {
      CheckBalance.addListener(checkRef.current);
    } else {
      setBalanceData([]);
      CheckBalance.removeListener(checkRef.current);
    }
    
    return () => {
      CheckBalance.removeListener(checkRef.current);
    };

  }, [ orderList.trading ]);

  return (
    <PageContainer title='작업중 내역'>
      <ContentBox>
        <FlexLeft flexAlign='left-top' flexGap='5px' flexSize='fit-content' flexHeight='fit-content'>
          <Flex flexSize='20px' flexAlign='center-top'>
            <div style={{ width: 'calc(100% - 15px)', height: '1px', border: '1px solid lightgray' }} />
          </Flex>
          {
            balanceData.length > 0 
              ? balanceData.map((trad) => (
                <>
                  <FlexLeft flexSize='50px'>
                    <Text text={`[${trad.code}] ${trad.name} / 매수가 : ${trad.amt} 원 / 현재가 : ${trad.currAmt} 원`} size={16} weight={700} whiteSpace='pre-line' />
                  </FlexLeft>
                  {trad.data.length > 0 ? (
                    <FlexLeft flexSize='200px'>
                      <LineChart
                        data={trad.data}
                        series={[
                          {
                            type: 'PointAndFill', 
                            keyY: 'currAmt',
                            lineStyle: { fill: 'lightgreen', fillOpacity: 0.6, stroke: 'lightgreen', strokeWidth: 2 }, 
                            pointStyle: { pointSize: 2 },
                          },
                          {
                            type: 'Line', 
                            keyY: 'targetAmtHigh',
                            lineStyle: { stroke: 'red', strokeWidth: 2 },
                          },
                          {
                            type: 'Line', 
                            keyY: 'targetAmtLow',
                            lineStyle: { stroke: 'blue', strokeWidth: 2 },
                          },
                        ]}
                        seriesConfig={{
                          keyX: 'time',
                          valueUnit: 5, 
                          minValue: Math.round(trad.targetAmtLow * 0.95),
                          maxValue: Math.round(trad.targetAmtHigh * 1.05),
                          labelX: {
                            renderer(val) {
                              const str = String(val);
                              const str2 = str.substring(str.length === 6 ? 2 : 1);
                              return `${str2.substring(0, 2)}:${str2.substring(2, 4)}`;
                            }, 
                          },
                          labelY: { extraMarginLeft: 5 },
                        }}
                        paddingTop={30}
                        paddingBottom={30}
                        paddingLeft={40}
                        paddingRight={10}
                      />
                    </FlexLeft>
                  ) : <Flex flexAlign='center'><Text text='아직 매수 전입니다.' /></Flex>}
                  <Flex flexSize='50px' flexAlign='center'>
                    <div style={{ width: 'calc(100% - 15px)', height: '1px', border: '1px solid lightgray' }} />
                  </Flex>
                </>
              ))
              : <Flex flexAlign='center'><Text text='No Data' size={16} /></Flex>
          }
        </FlexLeft>
      </ContentBox>
    </PageContainer>
  );
}