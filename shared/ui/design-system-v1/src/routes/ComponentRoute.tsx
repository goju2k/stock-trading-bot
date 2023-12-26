import { Flex } from '@mint-ui/core';
import { useContext } from 'react';

import { ComponentRoutesContext, ComponentRoutesContextInterface } from './ComponentRoutesContext';

export interface ComponentRouteProps {
  path:string;
  component:React.ReactNode;
}
export function ComponentRoute({ path, component }:ComponentRouteProps) {
  const { path: pathOfContext } = useContext<ComponentRoutesContextInterface>(ComponentRoutesContext);
  return (
    <Flex style={{ display: pathOfContext !== path ? 'none' : '', maxWidth: '700px' }}>
      {component}
    </Flex>
  );
}