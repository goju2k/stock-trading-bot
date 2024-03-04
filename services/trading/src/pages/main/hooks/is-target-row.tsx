import { ResponseVolumeRank } from '@shared/apis/kis';
import { AppConfig } from '@shared/states/global';
import { useRecoilValue } from 'recoil';

export function useIsTargetRow() {

  // 앱 설정
  const appConfig = useRecoilValue(AppConfig);

  return function isTargetRow(item:ResponseVolumeRank) {
    const per = Number(item.prdy_ctrt);
    const inc = Number(item.vol_inrt);
    return per > appConfig.targetUpRating && inc > appConfig.targetIncreaseRate;
  };
  
}