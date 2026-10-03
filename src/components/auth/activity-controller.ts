import type { AuthActivityState } from '@/types/auth-animation';
export const AUTH_TIMINGS = { typing: 900, reaction: 1800 };
export const INITIAL_ACTIVITY: AuthActivityState = { typing: false, error: false, success: false };
// Form reactions only: no gaming or random idle poses.
export function createAuthActivityController(publish: (state: AuthActivityState) => void) {
  let state = { ...INITIAL_ACTIVITY },
    paused = false,
    reducedMotion = false,
    disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const emit = (changes: Partial<AuthActivityState>) => {
    if (disposed) return;
    state = { ...state, ...changes };
    publish(state);
  };
  const later = (delay: number, changes: Partial<AuthActivityState>) => {
    timer = setTimeout(() => {
      timer = undefined;
      emit(changes);
    }, delay);
  };
  const activity = (textInput = false) => {
    if (disposed) return;
    clear();
    emit({ typing: textInput && !paused && !reducedMotion, error: false, success: false });
    if (state.typing) later(AUTH_TIMINGS.typing, { typing: false });
  };
  return {
    activity,
    setPaused(value: boolean) {
      if (paused === value || disposed) return;
      paused = value;
      // A responsive/focus change must not strand an error reaction.
      if (!state.error) clear();
      emit({ typing: false });
    },
    setReducedMotion(value: boolean) {
      reducedMotion = value;
      activity();
    },
    react(kind: 'error' | 'success') {
      if (disposed) return;
      clear();
      emit({ typing: false, error: kind === 'error', success: kind === 'success' });
      if (kind === 'error') later(AUTH_TIMINGS.reaction, { error: false });
    },
    reset: activity,
    dispose() {
      clear();
      disposed = true;
    },
  };
}
