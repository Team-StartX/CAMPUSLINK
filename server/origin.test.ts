import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { config } from './config';
import { trustedOrigin } from './origin';

const previous = { origin: config.origin, production: config.production };
beforeEach(() => {
  config.origin = 'http://localhost:3000';
  config.production = false;
});
afterEach(() => Object.assign(config, previous));
describe('browser request origins', () => {
  it('allows loopback aliases only on the configured local protocol and port', () => {
    expect(trustedOrigin('http://127.0.0.1:3000')).toBe(true);
    expect(trustedOrigin('http://[::1]:3000')).toBe(true);
    expect(trustedOrigin('http://localhost:3001')).toBe(false);
    expect(trustedOrigin('https://localhost:3000')).toBe(false);
    expect(trustedOrigin('http://localhost:3000.attacker.example')).toBe(false);
    expect(trustedOrigin('http://127.0.0.1:3000/path')).toBe(false);
    expect(trustedOrigin('invalid')).toBe(false);
  });
  it('requires the exact configured browser origin in production', () => {
    config.production = true;
    expect(trustedOrigin('http://localhost:3000')).toBe(true);
    expect(trustedOrigin('http://127.0.0.1:3000')).toBe(false);
    config.origin = 'https://campus.example';
    expect(trustedOrigin('https://campus.example')).toBe(true);
    expect(trustedOrigin('https://campus.example.attacker.example')).toBe(false);
    expect(trustedOrigin('http://localhost:3000')).toBe(false);
  });
});
