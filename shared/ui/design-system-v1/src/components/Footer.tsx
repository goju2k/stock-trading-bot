import { FlexBetween, FlexCenter, FlexLeft, FlexRight } from './Base/Flex';
import { NaviButton } from './Button/NaviButton';

export function Footer() {
  return (
    <FlexBetween rowDirection flexSize='40px'>
      <FlexLeft rowDirection flexGap='10px'>
        <FlexCenter flexSize='70px'>조회</FlexCenter>
        <FlexCenter flexSize='70px'>작업</FlexCenter>
        <FlexCenter flexSize='70px'>결과</FlexCenter>
      </FlexLeft>
      <FlexRight flexSize='40px'>
        <NaviButton />
      </FlexRight>
    </FlexBetween>
  );
}