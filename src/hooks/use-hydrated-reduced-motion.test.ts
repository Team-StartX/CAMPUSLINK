import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { useHydratedReducedMotion } from './use-hydrated-reduced-motion';

const preference = vi.hoisted(() => ({ reduced: null as boolean | null }));
vi.mock('framer-motion', () => ({ useReducedMotion: () => preference.reduced }));

function InitialAnimation() {
  const reduced = useHydratedReducedMotion();
  return createElement('div', { style: { opacity: reduced ? 1 : 0 } }, 'Career preview');
}

describe('initial animation hydration', () => {
  it('renders identical initial markup regardless of the browser motion preference', () => {
    preference.reduced = null;
    const serverMarkup = renderToString(createElement(InitialAnimation));
    for (const reduced of [false, true]) {
      preference.reduced = reduced;
      expect(renderToString(createElement(InitialAnimation))).toBe(serverMarkup);
    }
  });
});
