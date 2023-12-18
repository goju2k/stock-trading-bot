import { useState } from 'react';

import { ComponentRoutesContext, ComponentRoutesContextInterface } from './ComponentRoutesContext';

export function ComponentRoutes({ children }:{children:React.ReactNode;}) {
  const linkTo = (path:string) => {
    setContext({
      path,
      linkTo,
    });
  };
  const [ context, setContext ] = useState<ComponentRoutesContextInterface>({ path: '', linkTo });
  return (
    <ComponentRoutesContext.Provider value={context}>
      {children}
    </ComponentRoutesContext.Provider>
  );
}