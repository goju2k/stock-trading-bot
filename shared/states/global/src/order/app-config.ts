import { atom } from 'recoil';

export interface AppConfigBase {
  refreshRate: number;
  workingStart: string;
  workingEnd: string;
}
export type ChangeConfigFunction = (config:AppConfigBase) => void;
export interface AppConfigInterface extends AppConfigBase {}

export const AppConfig = atom<AppConfigInterface>({
  key: 'app-config',
  default: {
    refreshRate: 1000,
    workingStart: '0900',
    workingEnd: '1140',
  },
});