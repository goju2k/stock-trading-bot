import { createContext } from 'react';

export interface ComponentRoutesContextInterface {
  path:string;
  linkTo:(path:string)=>void;
}
export const ComponentRoutesContext = createContext({ path: '/', linkTo: (_path:string) => {} });