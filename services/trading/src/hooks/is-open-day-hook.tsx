import { BusinessDay } from '@shared/apis/kis';
import { useKisApi } from '@shared/hooks/api-hook';
import { DateUtil } from '@shared/utils/date';

export function useIsOpenDay() {
  // 휴장일 조회
  const [ businessDay ] = useKisApi(BusinessDay, { request: { params: { BASS_DT: DateUtil.getToday() } }, useCache: true });

  // 개장 여부
  const isOpen = businessDay && businessDay[0] ? businessDay[0].opnd_yn : undefined;

  return isOpen;
}