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
      <FlexLeft flexAlign='left-top' flexGap='5px'>
        {
          orderList.trading.length > 0 
            ? orderList.trading.map((trad) => <FlexLeft key={`order-${trad.code}`}>{trad.toString()}</FlexLeft>)
            : <Text text='없음' size={14} weight={500} />
        }
      </FlexLeft>
    </SidePanelContainer>
  );
}