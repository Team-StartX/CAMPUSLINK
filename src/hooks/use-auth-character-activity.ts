'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHydratedReducedMotion } from './use-hydrated-reduced-motion';
import { useAuthDesktop } from './use-auth-desktop';
import {
  createAuthActivityController,
  INITIAL_ACTIVITY,
} from '@/components/auth/activity-controller';
export function useAuthCharacterActivity(paused: boolean) {
  const desktop = useAuthDesktop();
  const suspended = paused || !desktop;
  const [activityState, setActivityState] = useState(INITIAL_ACTIVITY);
  const controller = useRef<ReturnType<typeof createAuthActivityController> | null>(null);
  const pausedRef = useRef(suspended);
  const reducedMotion = useHydratedReducedMotion();
  useEffect(() => {
    const engine = createAuthActivityController(setActivityState);
    engine.setPaused(pausedRef.current || document.hidden);
    controller.current = engine;
    const interact = () => engine.activity();
    window.addEventListener('pointerdown', interact, { passive: true });
    window.addEventListener('keydown', interact);
    const visibility = () => engine.setPaused(document.hidden || pausedRef.current);
    document.addEventListener('visibilitychange', visibility);
    engine.activity();
    return () => {
      engine.dispose();
      controller.current = null;
      window.removeEventListener('pointerdown', interact);
      window.removeEventListener('keydown', interact);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  useEffect(() => {
    pausedRef.current = suspended;
    controller.current?.setPaused(suspended || document.hidden);
  }, [suspended]);
  useEffect(() => {
    controller.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);
  const handleUserActivity = useCallback(
    (typing = false) => controller.current?.activity(typing),
    [],
  );
  const react = useCallback((kind: 'error' | 'success') => controller.current?.react(kind), []);
  return { ...activityState, handleUserActivity, react, reset: handleUserActivity };
}
