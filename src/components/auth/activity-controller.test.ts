import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuthActivityController, INITIAL_ACTIVITY } from './activity-controller';
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
function setup() {
  let state = INITIAL_ACTIVITY;
  const engine = createAuthActivityController((value) => {
    state = value;
  });
  return {
    engine,
    get state() {
      return state;
    },
  };
}
describe('original character reactions', () => {
  it('debounces typing from the last change without idle or gaming timers', () => {
    const view = setup();
    view.engine.activity(true);
    vi.advanceTimersByTime(500);
    view.engine.activity(true);
    vi.advanceTimersByTime(899);
    expect(view.state.typing).toBe(true);
    vi.advanceTimersByTime(1);
    expect(view.state.typing).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    view.engine.dispose();
  });
  it('suspends typing for mobile, hidden tabs and password focus', () => {
    const view = setup();
    view.engine.activity(true);
    view.engine.setPaused(true);
    view.engine.activity(true);
    expect(view.state.typing).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    view.engine.setPaused(false);
    view.engine.activity(true);
    expect(view.state.typing).toBe(true);
    view.engine.dispose();
  });
  it('expires errors even if loading or viewport changes', () => {
    const view = setup();
    view.engine.setPaused(true);
    view.engine.react('error');
    vi.advanceTimersByTime(500);
    view.engine.setPaused(false);
    vi.advanceTimersByTime(1299);
    expect(view.state.error).toBe(true);
    vi.advanceTimersByTime(1);
    expect(view.state.error).toBe(false);
    view.engine.dispose();
  });
  it('keeps success stable until navigation or new activity', () => {
    const view = setup();
    view.engine.react('success');
    vi.advanceTimersByTime(30000);
    expect(view.state.success).toBe(true);
    view.engine.activity();
    expect(view.state.success).toBe(false);
    view.engine.dispose();
  });
  it('does not animate typing with reduced motion', () => {
    const view = setup();
    view.engine.setReducedMotion(true);
    view.engine.activity(true);
    expect(view.state.typing).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    view.engine.dispose();
  });
  it('disposes pending reactions and ignores later calls', () => {
    const view = setup();
    view.engine.react('error');
    view.engine.dispose();
    const previous = view.state;
    view.engine.activity(true);
    view.engine.react('success');
    expect(vi.getTimerCount()).toBe(0);
    expect(view.state).toBe(previous);
  });
});
