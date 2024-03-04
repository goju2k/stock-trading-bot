import { Button, Text } from '@mint-ui/core';
import { useRerender } from '@shared/hooks/util-hook';
import { OrderStocks, OrderTrading, PassedList } from '@shared/states/global';
import { FlexBetween, FlexCenter, FlexLeft } from '@shared/ui/design-system-v1';
import { useRecoilState, useRecoilValue } from 'recoil';

export function SideElement() {
  
  const orderStocks = useRecoilValue(OrderStocks);
  const orderTrading = useRecoilValue(OrderTrading);
  
  const [ passedList, setPassedList ] = useRecoilState(PassedList);
  
  const rerender = useRerender();

  return (
    <>
      <FlexCenter flexSize='50px'>
        <Text text='처리중인 주문' size={16} weight={700} />
      </FlexCenter>
      <FlexLeft flexAlign='left-top' flexGap='5px' flexSize='fit-content' flexHeight='fit-content'>
        {
          orderTrading.length > 0 
            ? orderTrading.map((trad) => (
              <Text key={`log-${trad.code}`} text={trad.toString()} size={14} weight={500} whiteSpace='pre-line' textWidth='100%' />
            ))
            : <Text text='없음' size={14} weight={500} />
        }
      </FlexLeft>
      <FlexCenter flexSize='50px'>
        <Text text='이미 처리된 종목' size={16} weight={700} />
      </FlexCenter>
      <FlexLeft flexAlign='left-top' flexGap='5px' flexSize='fit-content' flexHeight='fit-content'>
        {
          orderStocks.length > 0 
            ? orderStocks.map((code) => (
              <Text key={`log-${code}`} text={code} size={14} weight={500} whiteSpace='pre-line' textWidth='100%' />
            ))
            : <Text text='없음' size={14} weight={500} />
        }
      </FlexLeft>
      
      <FlexBetween rowDirection flexSize='50px'>
        <Text text='처리 제외 종목' size={16} weight={700} />
        <Button onClick={() => {
          setPassedList([]);
          rerender();
        }}
        >초기화
        </Button>
      </FlexBetween>
      
      <FlexLeft flexAlign='left-top' flexGap='5px' flexSize='fit-content' flexHeight='fit-content'>
        {
          passedList.length > 0 
            ? <Text key='log-exclude' text={passedList.join(', ')} size={14} weight={500} whiteSpace='pre-line' textWidth='100%' />
            : <Text text='없음' size={14} weight={500} />
        }
      </FlexLeft>
    </>
  );
}