import { AxiosError, AxiosHeaders } from 'axios';

import { installTimestampedConsole } from './logger';

describe('installTimestampedConsole', () => {
  it('replaces AxiosError arguments with a summary that leaves out request headers', () => {
    const written: unknown[][] = [];
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      written.push(args);
    });
    installTimestampedConsole();

    const headers = new AxiosHeaders({ appsecret: 'SECRET-VALUE', Authorization: 'Bearer SECRET-TOKEN' });
    const config = { method: 'get', url: 'uapi/domestic-stock/v1/quotations/chk-holiday', headers };
    const error = new AxiosError('Request failed with status code 500', 'ERR_BAD_RESPONSE', config, undefined, {
      status: 500,
      statusText: 'Internal Server Error',
      headers: {},
      config,
      data: { rt_cd: 'nosession' },
    });

    console.error('[cron] openTodaySession failed', error);

    const line = written[0].map(String).join(' ');
    expect(line).toContain('GET uapi/domestic-stock/v1/quotations/chk-holiday');
    expect(line).toContain('status 500');
    expect(line).toContain('rt_cd=nosession');
    expect(line).not.toContain('SECRET');
  });
});