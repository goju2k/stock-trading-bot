import { Flex } from '@mint-ui/core';
import styled from 'styled-components';

// @mint-ui/core Flex는 flexHeight/flexOverflow를 안 주면 기본값이 height:100%, overflow:auto라서
// 컬럼으로 쌓인 카드들이 부모 높이를 억지로 나눠 갖다가 내용이 잘린다. fit-content로 고정.
export const Card = styled(Flex)`
  height: fit-content;
  overflow: visible;
  border: 1px solid lightgray;
  border-radius: 8px;
  padding: 12px;
`;