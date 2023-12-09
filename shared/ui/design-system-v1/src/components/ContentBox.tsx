import { Flex } from '@mint-ui/core';
import { PropsWithChildren } from 'react';

export interface ContentBoxProps {}
export function ContentBox({ children }:PropsWithChildren<ContentBoxProps>) {
  return <Flex style={{ maxWidth: '700px' }}>{children}</Flex>;
}