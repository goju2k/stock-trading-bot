import { AdvanceOrder, LogCenter, Main } from '@services/trading';
import { AppContainer, ComponentRoute, ComponentRoutes, GlobalStyleV1 } from '@shared/ui/design-system-v1';
import { RecoilRoot } from 'recoil';

export function App() {
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