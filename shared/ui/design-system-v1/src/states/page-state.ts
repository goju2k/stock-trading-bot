import { atom } from 'recoil';

export interface RecoilPageState {
  title: string;
}
export const PageState = atom<RecoilPageState>({
  key: 'page-state',
  default: { title: '' },
});