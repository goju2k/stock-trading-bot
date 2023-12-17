import styled from 'styled-components';

import { FlexCenter } from '../Base/Flex';

const NaviButtonContainer = styled(FlexCenter)`
  border-radius: 5px;
  &:active {
    background:lightgray;
  }
`;

export interface NaviButtonProps {
  click?:React.MouseEventHandler<HTMLDivElement>;
}
export function NaviButton({ click }:NaviButtonProps) {
  return (
    <NaviButtonContainer onClick={click}>
      <Hamburger />
    </NaviButtonContainer>
  );
}

function Hamburger() {
  return (
    <svg width={30} height={30} viewBox='0 0 100 100'>
      <line x1='10' y1='20' x2='90' y2='20' stroke='black' strokeWidth='4px' />
      <line x1='10' y1='50' x2='90' y2='50' stroke='black' strokeWidth='4px' />
      <line x1='10' y1='80' x2='90' y2='80' stroke='black' strokeWidth='4px' />
    </svg>
  );
}