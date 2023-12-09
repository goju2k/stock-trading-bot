import { VolumeRank } from './volume-rank';

describe('VolumeRank Fetch Test', () => {
  it('top 30 조회', async () => {
    const res = await VolumeRank({
      params: {
        FID_INPUT_PRICE_1: 2000,
        FID_INPUT_PRICE_2: 40000,
        FID_VOL_CNT: 1000000,
      },
    });
    expect(res.output).not.toBeNull();
  });

  it('top 30 조회 2', async () => {
    const res = await VolumeRank({
      params: {
        FID_INPUT_PRICE_1: 20000,
        FID_INPUT_PRICE_2: 400000,
        FID_VOL_CNT: 1000,
      },
    });
    expect(res.output).not.toBeNull();
  });
});