import { Text } from '@mint-ui/core';
import { useRecoilValue } from 'recoil';

import { FlexCenter, FlexLeft, FlexRight } from './Base/Flex';

import { PageState } from '../states/page-state';

export function Header() {
  const pageState = useRecoilValue(PageState);
  return (
    <FlexLeft rowDirection flexSize='40px'>
      <FlexLeft flexSize='50px' />
      <FlexCenter flexAlign='center'><Text text={pageState.title} size={20} weight={700} /></FlexCenter>
      <FlexRight flexSize='50px' />
    </FlexLeft>
  );
}