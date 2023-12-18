import { DetailedHTMLProps, useContext } from 'react';

import { ComponentRoutesContext, ComponentRoutesContextInterface } from './ComponentRoutesContext';

export interface ComponentRouteLinkProps extends Omit<DetailedHTMLProps<React.HTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>, 'onClick'> {
  to:string;
}
export function ComponentRouteLink({ to, children, ...props }:ComponentRouteLinkProps) {
  const { linkTo } = useContext<ComponentRoutesContextInterface>(ComponentRoutesContext);
  return (
    <a
      onClick={() => {
        linkTo(to);
      }}
      {...props}
    >
      {children}
    </a>
  );
}