'use client';

import { useSyncExternalStore } from 'react';
import { useReducedMotion } from 'framer-motion';

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useHydratedReducedMotion() {
  const hydrated = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const reduced = useReducedMotion();
  // Keep initial motion styles identical to the server before reading browser preferences.
  return hydrated && !!reduced;
}
