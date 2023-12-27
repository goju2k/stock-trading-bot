import { PropsWithChildren, useContext, useEffect, useRef } from 'react';
import { useSetRecoilState } from 'recoil';
import styled from 'styled-components';

import { Flex } from './Base/Flex';
import { Body } from './Body';
import { Footer } from './Footer';
import { Header } from './Header';

import { ComponentRoutesContext, ComponentRoutesContextInterface } from '../routes';
import { PageState } from '../states/page-state';

const PAGE_PADDING = '10px';

const PageWrapper = styled(Flex)`
  
`;

export interface PageContainerProps {
  title: string;
}
export function PageContainer({ title, children }:PropsWithChildren<PageContainerProps>) {

  const ref = useRef<HTMLDivElement|null>(null);

  const setPageState = useSetRecoilState(PageState);
  useEffect(() => {
    if (ref.current?.checkVisibility()) {
      setPageState({ title });
    }
  }, [ title ]);

  const pathContext = useContext<ComponentRoutesContextInterface>(ComponentRoutesContext);
  useEffect(() => {
    if (ref.current?.checkVisibility()) {
      setPageState({ title });
    }
  }, [ pathContext ]);

  return (
    <PageWrapper ref={ref} flexGap={PAGE_PADDING} flexPadding={PAGE_PADDING}>
      <Header />
      <Body>{children}</Body>
      <Footer />
    </PageWrapper>
  );
}