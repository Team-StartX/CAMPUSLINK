'use client';
import { useCallback, useState } from 'react';
import { useAuthCharacterActivity } from '@/hooks/use-auth-character-activity';
type FocusedField = 'name' | 'email' | 'password' | 'confirm' | null;
export function useAuthCharacterState(loading = false) {
  const [focused, setFocused] = useState<FocusedField>(null);
  const activity = useAuthCharacterActivity(
    loading || focused === 'password' || focused === 'confirm',
  );
  const notify = activity.handleUserActivity;
  const resetActivity = activity.reset;
  const react = activity.react;
  const focus = useCallback(
    (field: FocusedField) => {
      setFocused(field);
      notify();
    },
    [notify],
  );
  const blur = useCallback(() => {
    setFocused(null);
    notify();
  }, [notify]);
  const reset = useCallback(() => {
    setFocused(null);
    resetActivity();
  }, [resetActivity]);
  const type = useCallback(() => notify(true), [notify]);
  const succeed = useCallback(() => react('success'), [react]);
  const fail = useCallback(() => react('error'), [react]);
  return { ...activity, focused, focus, blur, reset, type, succeed, fail };
}
