import { Main } from '@services/trading';
import { AppContainer, GlobalStyleV1 } from '@shared/ui/design-system-v1';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { RecoilRoot } from 'recoil';

export function App() {
  return (
    <>
      <GlobalStyleV1 />
      <RecoilRoot>
        <AppContainer>
          <BrowserRouter>
            <Routes>
              <Route path='*' element={<Main />} />
            </Routes>
          </BrowserRouter>
        </AppContainer>
      </RecoilRoot>
    </>
  );
}

export default App;