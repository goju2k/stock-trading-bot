import { AdvanceOrder, LogCenter, Main } from '@services/trading';
import { CheckBalance } from '@shared/apis/kis';
import { AppContainer, ComponentRoute, ComponentRoutes, GlobalStyleV1, MainToastContextProvider } from '@shared/ui/design-system-v1';
import { useEffect } from 'react';
import { RecoilRoot } from 'recoil';

import { SideElement } from './components/SideElement';

export function App() {

  // 잔고조회 프로세스 시작
  useEffect(() => {
    CheckBalance.run();
    return () => {
      CheckBalance.destroy();
    };
  }, []);
  
  return (
    <>
      <GlobalStyleV1 />
      <RecoilRoot>
        <MainToastContextProvider>
          <AppContainer sidePanel={<SideElement />}>
            <ComponentRoutes>
              <ComponentRoute path='advance-order' component={<AdvanceOrder />} />
              <ComponentRoute path='log-center' component={<LogCenter />} />
              <ComponentRoute path='' component={<Main />} />
            </ComponentRoutes>
          </AppContainer>
        </MainToastContextProvider>
      </RecoilRoot>
    </>
  );
}

export default App;