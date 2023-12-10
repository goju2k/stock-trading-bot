import { Text } from '@mint-ui/core';

import { FlexBetween, FlexCenter, FlexLeft, FlexRight } from './Base/Flex';
import { NaviButton } from './Button/NaviButton';

export function Footer() {
  return (
    <FlexBetween rowDirection flexSize='40px'>
      <FlexLeft rowDirection flexGap='10px'>
        <MenuButton label='조회' />
        <MenuButton label='작업' />
        <MenuButton label='결과' />
      </FlexLeft>
      <FlexRight flexSize='40px'>
        <NaviButton />
      </FlexRight>
    </FlexBetween>
  );
}

function MenuButton({ label }:{label:string;}) {
  return (
    <FlexCenter flexSize='70px'>
      <Text text={label} size={16} weight={700} />
    </FlexCenter>
  );
}