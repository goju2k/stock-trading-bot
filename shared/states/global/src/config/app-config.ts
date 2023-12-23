import { ObjectBasedLocalStore } from '@shared/utils/localstorage';
import { atom } from 'recoil';

export interface AppConfigBase {
  'refreshRate': number;
  'workingStart': string;
  'workingEnd': string;
  'highPercentage': number;
  'lowPercentage': number;
}

export const AppConfigStore = new ObjectBasedLocalStore<AppConfigBase>('app-config');

let defaultValue = AppConfigStore.get();
if (Object.getOwnPropertyNames(defaultValue).length === 0) {
  defaultValue = {
    refreshRate: 1000,
    workingStart: '0900',
    workingEnd: '1140',
    highPercentage: 3,
    lowPercentage: 4,
  };
}

export const AppConfig = atom<AppConfigBase>({
  key: 'app-config',
  default: defaultValue,
  effects: [
    ({ onSet }) => {
      onSet((newValue, _, isReset) => {
        !isReset && AppConfigStore.set(newValue);
      });
    },
  ],
});