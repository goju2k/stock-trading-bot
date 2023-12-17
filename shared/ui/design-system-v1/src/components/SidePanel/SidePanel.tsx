import styled from 'styled-components';

import { Flex } from '../Base/Flex';

const SidePanelContainer = styled(Flex).withConfig<{sideWidth:number;}>({ shouldForwardProp: (prop) => String(prop) !== 'sideWidth' })`
  position: fixed;
  z-iindex: 1000;
  width: ${({ sideWidth }) => sideWidth}px;
  left: calc(100% - ${({ sideWidth }) => sideWidth}px);
  top: 0px;

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
  return (
    <SidePanelContainer
      onClick={(e) => {
        e.stopPropagation();
      }}
      sideWidth={sideWidth}
      style={{
        display: open ? '' : 'none',
        background: 'lightgray',
        animation: 'side-show 0.25s cubic-bezier(0, 0, 0, 1)',
      }}
    >side
    </SidePanelContainer>
  );
}