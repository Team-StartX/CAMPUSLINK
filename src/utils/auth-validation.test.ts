import { describe, expect, it } from 'vitest';
import { authSchema } from './auth-validation';

describe('login and signup validation', () => {
  it('sends an existing short password to login instead of applying signup policy', () => {
    expect(
      authSchema(false, true).parse({ email: ' Person@Example.com ', password: 'old123' }),
    ).toEqual({ email: 'person@example.com', password: 'old123' });
    expect(
      authSchema(false, true).safeParse({ email: 'person@example.com', password: '' }).success,
    ).toBe(false);
  });
  it('keeps the stronger API signup policy and checks password confirmation', () => {
    const input = {
      email: 'person@example.com',
      name: 'Test Person',
      institution: 'Test College',
      password: 'short123',
      confirm: 'short123',
    };
    expect(authSchema(true, true).safeParse(input).success).toBe(false);
    expect(
      authSchema(true, true).safeParse({
        ...input,
        password: 'LongPassword123',
        confirm: 'different',
      }).success,
    ).toBe(false);
    expect(
      authSchema(true, true).safeParse({
        ...input,
        password: 'LongPassword123',
        confirm: 'LongPassword123',
      }).success,
    ).toBe(true);
  });
  it('catches invalid names and institutions before registration reaches the server', () => {
    const result = authSchema(true, true).safeParse({
      email: 'person@example.com',
      password: 'LongPassword123',
      confirm: 'LongPassword123',
      name: ' ',
      institution: 'A',
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(['name', 'institution']);
  });
});
