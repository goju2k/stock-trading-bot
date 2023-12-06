import { VolumeRank } from '@shared/apis/kis';

export function Main() {
  return (
    <div>
      <button onClick={async () => {
        const data = await VolumeRank({
          FID_INPUT_PRICE_1: 2000,
          FID_INPUT_PRICE_2: 40000,
          FID_VOL_CNT: 1000000,
        });
        console.log('data', data);
      }}
      >전송
      </button>
    </div>
  );
}