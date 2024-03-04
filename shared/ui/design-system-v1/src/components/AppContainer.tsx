import { Flex } from '@mint-ui/core';
import { PropsWithChildren } from 'react';

import { SidePanelContextProvider } from './SidePanel/SidePanel';

export interface AppContainerProps {
  sidePanel:React.ReactNode;
}
export function AppContainer({ sidePanel, children }:PropsWithChildren<AppContainerProps>) {
  return (
    <Flex style={{ width: '100vw', height: '100vh' }} flexAlign='center' flexOverflow='hidden'>
      <SidePanelContextProvider sideNode={sidePanel}>
        {children}
      </SidePanelContextProvider>
    </Flex>
  );
}