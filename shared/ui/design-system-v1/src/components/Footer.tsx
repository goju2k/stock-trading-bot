import { Text } from '@mint-ui/core';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

import { FlexBetween, FlexCenter, FlexLeft, FlexRight } from './Base/Flex';
import { NaviButton } from './Button/NaviButton';
import { SidePanel } from './SidePanel/SidePanel';

export function Footer() {
  const [ sideOpen, setSideOpen ] = useState(false);

  useEffect(() => {
    const sideCloseOnClick = () => {
      setSideOpen(false);
    };
    window.addEventListener('click', sideCloseOnClick);
    return () => {
      window.removeEventListener('click', sideCloseOnClick);
    };
  }, []);

  return (
    <FlexBetween rowDirection flexSize='40px'>
      <FlexLeft rowDirection flexGap='20px'>
        <MenuButton label='거래량조회' path='/' />
        <MenuButton label='예약주문설정' path='/advance-order' />
        <MenuButton label='작업로그' path='/log-center' />
      </FlexLeft>
      <FlexRight flexSize='40px'>
        <NaviButton click={(e) => {
          setSideOpen(true);
          e.stopPropagation();
        }}
        />
      </FlexRight>
      <SidePanel sideWidth={230} open={sideOpen} />
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
      <Link to={path} style={{ width: 'fit-content' }}>
        <Text
          text={label}
          size={16}
          weight={700}
        />
      </Link>
    </MenuButtonContainer>
  );
}