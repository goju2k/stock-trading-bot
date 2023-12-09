import { PropsWithChildren, useEffect } from 'react';
import { useSetRecoilState } from 'recoil';
import styled from 'styled-components';

import { Flex } from './Base/Flex';
import { Body } from './Body';
import { Footer } from './Footer';
import { Header } from './Header';

import { PageState } from '../states/page-state';

const PAGE_PADDING = '10px';

const PageWrapper = styled(Flex)`
  max-width: 700px;
`;

export interface PageContainerProps {
  title: string;
}
export function PageContainer({ title, children }:PropsWithChildren<PageContainerProps>) {
  const setPageState = useSetRecoilState(PageState);
  useEffect(() => {
    setPageState({ title });
  }, [ title ]);

  return (
    <PageWrapper flexGap={PAGE_PADDING} flexPadding={PAGE_PADDING}>
      <Header />
      <Body>{children}</Body>
      <Footer />
    </PageWrapper>
  );
}