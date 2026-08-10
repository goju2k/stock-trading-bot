-- AlterTable
-- marketRegimeFilterEnabled는 잘못된 방향의 설계였다 - 원래 의도는 "게이트 자체를 켜고 끄는
-- config"가 아니라 "market-condition.ts의 초기/리셋 상태(bullish)를 허용이 아니라 중단으로
-- 시작"하는 것이었다(2026-08-10). 그 수정은 market-condition.ts 코드 레벨에서 처리했으므로
-- 이 config 필드는 필요 없어져서 바로 삭제.
ALTER TABLE "trading_config" DROP COLUMN "marketRegimeFilterEnabled";
