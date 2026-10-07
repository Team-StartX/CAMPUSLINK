import { describe, expect, it } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import { requestErrorMessage } from './client';

describe('API errors', () => {
  it('preserves actionable authentication errors from the server', () => {
    const response = {
      status: 401,
      data: { message: 'Email or password is incorrect.' },
    } as AxiosResponse;
    expect(
      requestErrorMessage(
        new AxiosError('Request failed', undefined, undefined, undefined, response),
      ),
    ).toBe('Email or password is incorrect.');
  });
  it('turns an offline API, HTML proxy failure, and timeout into readable messages', () => {
    expect(requestErrorMessage(new AxiosError('Network Error', 'ERR_NETWORK'))).toContain(
      'could not connect to CampusLink',
    );
    const response = { status: 502, data: '<html>Bad gateway</html>' } as AxiosResponse;
    expect(
      requestErrorMessage(
        new AxiosError('Request failed', undefined, undefined, undefined, response),
      ),
    ).toContain('could not connect to CampusLink');
    expect(requestErrorMessage(new AxiosError('timeout', 'ECONNABORTED'))).toContain(
      'taking too long',
    );
  });
});
