import styled from 'styled-components';

import { FlexCenter } from '../Base/Flex';

const NaviButtonContainer = styled(FlexCenter)`
  border-radius: 5px;
  &:active {
    background:lightgray;
  }
`;

export function NaviButton() {
  return (
    <NaviButtonContainer>
      <Hamburger />
    </NaviButtonContainer>
  );
}

function Hamburger() {
  return (
    <svg width={40} height={40} viewBox='0 0 100 100'>
      <line x1='10' y1='20' x2='90' y2='20' stroke='black' />
      <line x1='10' y1='50' x2='90' y2='50' stroke='black' />
      <line x1='10' y1='80' x2='90' y2='80' stroke='black' />
    </svg>
  );
}