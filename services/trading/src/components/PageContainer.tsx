import { Flex } from '@mint-ui/core';
import { PropsWithChildren } from 'react';

export interface PageContainerProps {}
export function PageContainer({ children }:PropsWithChildren<PageContainerProps>) {
  return <Flex style={{ width: '100vw', height: '100vh' }} flexAlign='center' flexPadding='10px' flexOverflow='hidden'>{children}</Flex>;
}