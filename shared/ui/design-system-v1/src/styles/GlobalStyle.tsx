import { createGlobalStyle } from 'styled-components';

import { GridCss } from './GridStyle';

export const GlobalStyleV1 = createGlobalStyle`

  @import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css");

  * {
    // Layout
    box-sizing: border-box;
    margin: 0;

    // Typography
    font-size: 16px;
    color: #303132;
    font-family: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif;
    font-style: normal;
    font-weight: 400;
    line-height: 156%;
  }

  // Grid
  ${GridCss}

`;