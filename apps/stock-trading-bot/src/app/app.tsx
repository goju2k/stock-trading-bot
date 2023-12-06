import { Main } from '@services/trading';
import styled from 'styled-components';

import { GlobalStyleV1 } from '../styles/GlobalStyle';

const StyledApp = styled.div`
  // Your style here
`;

export function App() {
  return (
    <StyledApp>
      <GlobalStyleV1 />
      <Main />
    </StyledApp>
  );
}

export default App;