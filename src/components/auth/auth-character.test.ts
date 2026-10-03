import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AuthCharacter, type AuthCharacterProps } from './auth-character';
import { AuthInput, PasswordInput } from './auth-input';
import { AuthBrandPanel } from './auth-brand-panel';

const idle: AuthCharacterProps = {
  emailFocused: false,
  typing: false,
  passwordFocused: false,
  passwordVisible: false,
  success: false,
  error: false,
};
describe('authentication character fallback', () => {
  it.each([
    ['idle', {}],
    ['focused', { emailFocused: true }],
    ['typing', { emailFocused: true, typing: true }],
    ['covered', { passwordFocused: true, typing: true }],
    ['peek', { passwordFocused: true, passwordVisible: true }],
    ['error', { passwordFocused: true, error: true }],
    ['success', { success: true, error: true }],
  ] as [string, Partial<AuthCharacterProps>][])(
    'renders %s with the expected state priority',
    (state, changes) => {
      const html = renderToString(createElement(AuthCharacter, { ...idle, ...changes }));
      expect(html).toContain(`data-state="${state}"`);
      expect(html).toContain('auth-character-fallback');
      expect(html).not.toContain('<canvas');
      expect(html).toContain('aria-hidden="true"');
    },
  );
});
describe('authentication input accessibility', () => {
  it('connects validation feedback to the labeled input', () => {
    const html = renderToString(
      createElement(AuthInput, {
        id: 'email',
        label: 'Email',
        error: 'Invalid email',
        inputProps: { name: 'email', type: 'email' },
      }),
    );
    expect(html).toContain('for="email"');
    expect(html).toContain('aria-describedby="email-error"');
    expect(html).toContain('aria-invalid="true"');
  });
  it.each([false, true])('keeps the visibility control out of form submission: %s', (visible) => {
    const html = renderToString(
      createElement(PasswordInput, {
        id: 'password',
        label: 'Password',
        inputProps: { name: 'password' },
        visible,
        onToggle: () => {},
      }),
    );
    expect(html).toContain(`type="${visible ? 'text' : 'password'}"`);
    expect(html).toContain('type="button"');
    expect(html).toContain(`aria-label="${visible ? 'Hide' : 'Show'} password"`);
  });
});

describe('mobile-safe authentication rendering', () => {
  it('does not mount an animation or decorative panel before viewport detection', () => {
    const html = renderToString(createElement(AuthBrandPanel, idle));
    expect(html).toBe('');
  });
});
