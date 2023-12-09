import { Flex } from '@mint-ui/core';
import { PropsWithChildren } from 'react';

export interface AppContainerProps {}
export function AppContainer({ children }:PropsWithChildren<AppContainerProps>) {
  return <Flex style={{ width: '100vw', height: '100vh' }} flexAlign='center' flexOverflow='hidden'>{children}</Flex>;
}