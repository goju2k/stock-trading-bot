import { PropsWithChildren } from 'react';

import { Flex } from './Base/Flex';

export interface BodyProps {}
export function Body({ children }:PropsWithChildren<BodyProps>) {
  return <Flex>{children}</Flex>;
}