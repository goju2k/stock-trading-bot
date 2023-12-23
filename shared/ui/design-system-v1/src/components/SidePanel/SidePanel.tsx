import { Text } from '@mint-ui/core';
import { OrderList } from '@shared/states/global';
import { useRecoilValue } from 'recoil';
import styled from 'styled-components';

import { Flex, FlexCenter, FlexLeft } from '../Base/Flex';

const SidePanelContainer = styled(Flex).withConfig<{sideWidth:number;}>({ shouldForwardProp: (prop) => String(prop) !== 'sideWidth' })`
  position: fixed;
  z-iindex: 1000;
  width: ${({ sideWidth }) => sideWidth}px;
  left: calc(100% - ${({ sideWidth }) => sideWidth}px);
  top: 0px;
  padding: 15px;
  background: #ededed;
  border-left: 1px solid lightgray;
  box-shadow: 5px 5px 5px 5px lightgray;
  animation: side-show 0.25s cubic-bezier(0, 0, 0, 1);

  @keyframes side-show {
    from {
      left: 100%;
    }
    to {
      left: calc(100% - ${({ sideWidth }) => sideWidth}px);
    }
  }

`;

export interface SidePanelProps {
  open:boolean;
  sideWidth:number;
}
export function SidePanel({ open, sideWidth }:SidePanelProps) {
  const orderList = useRecoilValue(OrderList);
  return (
    <SidePanelContainer
      onClick={(e) => {
        e.stopPropagation();
      }}
      sideWidth={sideWidth}
      style={{ display: open ? '' : 'none' }}
      flexGap='10px'
    >
      <FlexCenter flexSize='50px'>
        <Text text='처리중인 주문' size={16} weight={700} />
      </FlexCenter>
      <FlexLeft flexAlign='left-top' flexGap='5px' flexSize='fit-content' flexHeight='fit-content'>
        {
          orderList.trading.length > 0 
            ? orderList.trading.map((trad) => (
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
          orderList.stocks.length > 0 
            ? orderList.stocks.map((code) => (
              <Text key={`log-${code}`} text={code} size={14} weight={500} whiteSpace='pre-line' textWidth='100%' />
            ))
            : <Text text='없음' size={14} weight={500} />
        }
      </FlexLeft>
    </SidePanelContainer>
  );
}