import { useRecoilValue } from 'recoil';

import { FlexCenter, FlexLeft, FlexRight } from './Base/Flex';

import { PageState } from '../states/page-state';

export function Header() {
  const pageState = useRecoilValue(PageState);
  return (
    <FlexLeft rowDirection flexSize='40px'>
      <FlexLeft flexSize='50px' />
      <FlexCenter flexAlign='center'>{pageState.title}</FlexCenter>
      <FlexRight flexSize='50px' />
    </FlexLeft>
  );
}