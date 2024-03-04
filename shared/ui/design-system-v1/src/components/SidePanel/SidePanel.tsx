import { Flex } from '@mint-ui/core';
import { createContext, useContext, useEffect, useState } from 'react';
import styled from 'styled-components';

const SidePanelContainer = styled(Flex).withConfig<{sideWidth:number;}>({ shouldForwardProp: (prop) => String(prop) !== 'sideWidth' })`
  position: fixed;
  z-index: 1000;
  width: ${({ sideWidth }) => sideWidth}px;
  left: calc(100% - ${({ sideWidth }) => sideWidth}px);
  top: 0px;
  padding: 15px;
  background: #ededed;
  border-left: 1px solid lightgray;
  box-shadow: 5px 5px 5px 5px lightgray;
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

export const SidePanelContext = createContext({ openState: false, open: (_open:boolean) => {} });
export function SidePanelContextProvider({ sideNode, children }:{sideNode:React.ReactNode; children:React.ReactNode;}) {

  const [ sideOpen, setSideOpen ] = useState({
    openState: false,
    open: (open:boolean) => {
      setSideOpen({ ...sideOpen, openState: open });
    }, 
  });

  useEffect(() => {
    const sideCloseOnClick = () => {
      sideOpen.open(false);
    };
    window.addEventListener('click', sideCloseOnClick);
    return () => {
      window.removeEventListener('click', sideCloseOnClick);
    };
  }, []);

  return (
    <SidePanelContext.Provider value={sideOpen}>
      <SidePanel element={sideNode} open={sideOpen.openState} sideWidth={250} />
      {children}
    </SidePanelContext.Provider>
  );
}

export function useSideOpen() {
  const side = useContext(SidePanelContext);
  return side.open;
}

export interface SidePanelProps {
  open:boolean;
  sideWidth:number;
  element:React.ReactNode;
}

export function SidePanel({ element, open, sideWidth }:SidePanelProps) {
  
  return (
    <SidePanelContainer
      onClick={(e) => {
        e.stopPropagation();
      }}
      sideWidth={sideWidth}
      style={{ display: open ? '' : 'none' }}
      flexGap='10px'
    >
      {element}
      
    </SidePanelContainer>
  );
}