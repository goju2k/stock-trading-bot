import { useContext } from 'react';

import { ComponentRoutesContext, ComponentRoutesContextInterface } from './ComponentRoutesContext';

export interface ComponentRouteProps {
  path:string;
  component:React.ReactNode;
}
export function ComponentRoute({ path, component }:ComponentRouteProps) {
  const { path: pathOfContext } = useContext<ComponentRoutesContextInterface>(ComponentRoutesContext);
  if (pathOfContext !== path) {
    return null;
  }
  return (
    <>
      {component}
    </>
  );
}