import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@/types';
import { PublicSessionProvider, PublicStartLink } from './public-session';
import { useSession } from '@/store/session';

const session = vi.hoisted(() => ({ user: null as User | null, ready: false, override: true }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useContext: (context: React.Context<unknown>) =>
      session.override ? session : actual.useContext(context),
  };
});

afterEach(() => {
  session.user = null;
  session.ready = false;
  session.override = true;
  useSession.getState().setUser(null);
});

function markup() {
  return renderToString(
    createElement(PublicStartLink, { href: '/register?role=student' }, 'Get started'),
  );
}

describe('public authentication actions', () => {
  it('does not show signup while checking the session', () => {
    expect(markup()).toContain('aria-busy="true"');
    expect(markup()).not.toContain('/register');
  });
  it('keeps signup available for a signed-out visitor', () => {
    session.ready = true;
    expect(markup()).toContain('href="/register?role=student"');
    expect(markup()).toContain('Get started');
  });
  it.each(['student', 'recruiter', 'campus'] as const)(
    'opens the %s dashboard after login',
    (role) => {
      session.ready = true;
      session.user = { id: 'user', name: 'Test', email: 'test@example.com', role };
      expect(markup()).toContain(`href="/${role}/dashboard"`);
      expect(markup()).toContain('Go to dashboard');
      expect(markup()).not.toContain('/register');
    },
  );
  it('renders the same provider markup before hydration with or without a stored account', () => {
    session.override = false;
    const render = () =>
      renderToString(
        createElement(
          PublicSessionProvider,
          null,
          createElement(PublicStartLink, { href: '/register' }, 'Get started'),
        ),
      );
    const initial = render();
    expect(initial).toContain('Checking session');
    useSession
      .getState()
      .setUser({ id: 'user', name: 'Test', email: 'test@example.com', role: 'student' });
    expect(render()).toBe(initial);
  });
  it.each(['student', 'recruiter', 'campus'] as const)(
    'keeps the %s dashboard accessible through the navbar profile icon',
    (role) => {
      session.ready = true;
      session.user = { id: 'user', name: 'Test', email: 'test@example.com', role };
      const icon = renderToString(
        createElement(PublicStartLink, { href: '/register', iconOnly: true }, 'Get started'),
      );
      expect(icon).toContain(`href="/${role}/dashboard"`);
      expect(icon).toContain('aria-label="Go to dashboard"');
      expect(icon).toContain('<svg');
      expect(icon).not.toContain(' Go to dashboard<');
      expect(icon).not.toContain('Get started');
    },
  );
});
