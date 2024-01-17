import { useState } from 'react';

export function useRerender() {
  const [ renderSwitch, setRenderSwitch ] = useState(true);

  const rerender = () => {
    setRenderSwitch(!renderSwitch);
  };

  return rerender;
}