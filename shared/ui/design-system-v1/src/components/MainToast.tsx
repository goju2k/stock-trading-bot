import { Toast, ToastControl } from '@mint-ui/core';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

// context
interface MainToastContextType {
  show:(message:string)=>void;
  message?:string;
}

export const MainToastContext = createContext<MainToastContextType>({ show() {} });

// context provider
export function MainToastContextProvider({ children }:{children:React.ReactNode;}) {
  
  // toast context
  const toastContext = useToastContextProvider();

  return (
    <MainToastContext.Provider value={toastContext}>
      <MainToast />
      {children}
    </MainToastContext.Provider>
  );
}

export function useToastContextProvider() {
  const show = (message:string) => {
    setToastContext({ ...toastContext, message });
  };
  const [ toastContext, setToastContext ] = useState<MainToastContextType>({ show });
  return toastContext;
}

// Toast Component
const ToastBody = styled.div`
  padding: 10px 20px;
  border: 1px solid gray;
  border-radius: 5px;
  background: white;
  white-space: pre-line;
  width: fit-content;
  max-width: 80vw;
  max-height: 90px;
  overflow-y: auto;
`;
export function MainToast() {

  const toastRef = useRef<ToastControl | null>(null);

  const toastContext = useContext(MainToastContext);
  useEffect(() => {
    if (toastContext.message) {
      const deltaX = (measureText(toastContext.message) + 42) / 2;
      const rect = document.body.getBoundingClientRect();
      const offsetLeft = Math.max(rect.width / 2 - deltaX, rect.width * 0.1);
      toastRef.current?.showMessage(toastContext.message, document.body, offsetLeft, rect.height * 0.8);
    }
  }, [ toastContext ]);

  return (
    <Toast
      timeToShow={2000}
      ref={toastRef}
      toastBody={(
        <ToastBody>
          {toastContext.message}
        </ToastBody>
      )}
    />
  );
}

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

function measureText(text:string) {
  
  if (!ctx) {
    return 0;
  }

  ctx.font = '14px Pretendard';
  return ctx.measureText(text).width;
}

// Toast Hook
export function useShowToastHook() {
  const toast = useContext(MainToastContext);
  return toast.show;
}