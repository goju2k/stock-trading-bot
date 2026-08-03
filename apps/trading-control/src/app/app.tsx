import { Flex, Text } from '@mint-ui/core';
import { ComponentRoute, ComponentRouteLink, ComponentRoutes, GlobalStyleV1, MainToastContextProvider } from '@shared/ui/design-system-v1';
import styled from 'styled-components';

import { ConfigPage } from './pages/ConfigPage';
import { DashboardPage } from './pages/DashboardPage';
import { LogsPage } from './pages/LogsPage';

const AppShell = styled(Flex)`
  width: 100vw;
  height: 100vh;
  overflow: hidden;
`;

const NavBar = styled(Flex)`
  flex: 0 0 44px;
  border-bottom: 1px solid lightgray;
`;

const ContentArea = styled(Flex)`
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 16px;
`;

function NavLink({ to, label }: { to: string; label: string; }) {
  return (
    <ComponentRouteLink to={to} style={{ padding: '0 16px', height: '100%', display: 'flex', alignItems: 'center' }}>
      <Text text={label} size={15} weight={600} />
    </ComponentRouteLink>
  );
}

export function App() {
  return (
    <>
      <GlobalStyleV1 />
      <MainToastContextProvider>
        <ComponentRoutes>
          <AppShell>
            <NavBar rowDirection alignItems='center'>
              <NavLink to='' label='대시보드' />
              <NavLink to='config' label='설정' />
              <NavLink to='logs' label='로그' />
            </NavBar>
            <ContentArea>
              <ComponentRoute path='' component={<DashboardPage />} />
              <ComponentRoute path='config' component={<ConfigPage />} />
              <ComponentRoute path='logs' component={<LogsPage />} />
            </ContentArea>
          </AppShell>
        </ComponentRoutes>
      </MainToastContextProvider>
    </>
  );
}

export default App;