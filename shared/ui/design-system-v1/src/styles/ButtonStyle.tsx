import { css } from 'styled-components';

export const ButtonCss = css`
  .mint-button {
    border: 0;
    border-radius: 4px;
    background-color: #03c75a;
    box-shadow: 0 2px 4px 0 rgba(3,199,90,.12);
    text-decoration: none;
    color: #fff;
    height: 30px;
    font-size: 14px;

    &:active{
      background-color: #00d55f;
    }
    &:disabled{
      background-color: #b1c3b9;
    }
  }
`;