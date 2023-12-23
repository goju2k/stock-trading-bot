import { VolumeRank } from './volume-rank';

describe('VolumeRank Fetch Test', () => {
  it('거래량 top 30 조회', async () => {
    const res = await VolumeRank({
      params: {
        FID_INPUT_PRICE_1: 2000,
        FID_INPUT_PRICE_2: 40000,
        FID_VOL_CNT: 1000000,
      },
    });
    console.log('거래량 top 30 조회결과 0번째', res.output[0]);
    expect(res.output).not.toBeNull();
  });
});