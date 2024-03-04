import { Text } from '@mint-ui/core';
import styled from 'styled-components';

import { FlexBetween, FlexCenter, FlexLeft, FlexRight } from './Base/Flex';
import { NaviButton } from './Button/NaviButton';
import { useSideOpen } from './SidePanel/SidePanel';

import { ComponentRouteLink } from '../routes/ComponentRouteLink';

export function Footer() {
  
  // side context
  const sideOpen = useSideOpen();

  return (
    <FlexBetween rowDirection flexSize='40px'>
      <FlexLeft rowDirection flexGap='20px'>
        <MenuButton label='거래량조회' path='' />
        <MenuButton label='작업중' path='log-center' />
        <MenuButton label='주문설정' path='advance-order' />
      </FlexLeft>
      <FlexRight flexSize='40px'>
        <NaviButton click={(e) => {
          sideOpen(true);
          e.stopPropagation();
        }}
        />
      </FlexRight>
    </FlexBetween>
  );
}

interface MenuButtonProps {
  label:string;
  path:string;
}

const MenuButtonContainer = styled(FlexCenter)`
  border-radius: 5px;
  overflow: hidden;
  flex:0 0 fit-content;
  &:active {
    background:lightgray;
  }
`;

function MenuButton({ label, path }:MenuButtonProps) {
  return (
    <MenuButtonContainer>
      <ComponentRouteLink to={path} style={{ width: 'fit-content' }}>
        <Text
          text={label}
          size={16}
          weight={700}
        />
      </ComponentRouteLink>
    </MenuButtonContainer>
  );
}