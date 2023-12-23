import { InquireBalance } from './inquire-balance';

describe('InquireBalance Fetch Test', () => {
  it('주식잔고조회', async () => {
    const res = await InquireBalance();
    console.log('잔고조회결과', res.output1);
    expect(res.output1).not.toBeNull();
  });
});