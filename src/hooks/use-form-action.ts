'use client';
import { useRef, useState } from 'react';

export function useFormAction() {
  const inFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError('');
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save. Please try again.');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  return { save, saving, error, clearError: () => setError('') };
}
