import { AdvanceOrder, LogCenter, Main } from '@services/trading';
import { CheckBalance } from '@shared/apis/kis';
import { AppContainer, ComponentRoute, ComponentRoutes, GlobalStyleV1 } from '@shared/ui/design-system-v1';
import { useEffect } from 'react';
import { RecoilRoot } from 'recoil';

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
        <AppContainer>
          <ComponentRoutes>
            <ComponentRoute path='advance-order' component={<AdvanceOrder />} />
            <ComponentRoute path='log-center' component={<LogCenter />} />
            <ComponentRoute path='' component={<Main />} />
          </ComponentRoutes>
        </AppContainer>
      </RecoilRoot>
    </>
  );
}

export default App;