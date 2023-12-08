import { Flex } from '@mint-ui/core';
import { useEffect, useRef, useState } from 'react';

export interface MessageBoxProps {
  message?:{content:string;};
  clear?:boolean;
  clearTime?:number;
}
export function MessageBox({
  message,
  clear,
  clearTime = 2000,
}:MessageBoxProps) {
  const [ messageState, setMessageState ] = useState(message);

  const timeToClear = useRef(0);
  useEffect(() => {
    timeToClear.current = Date.now();
    setMessageState({ content: message?.content || '' });
    clear && setTimeout(() => {
      if (Date.now() - timeToClear.current >= clearTime) {
        setMessageState({ content: '' });
      }
    }, clearTime);
  }, [ clear, clearTime, message ]);

  return <Flex flexAlign='left-center'>{messageState?.content || ''}</Flex>;
}