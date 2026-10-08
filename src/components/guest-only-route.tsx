'use client';

import { authService, useSession } from '@/store/session';
import { dashboardPath } from '@/utils/permissions';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Loader } from './loader';

export function GuestOnlyRoute({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useSession((state) => state.user);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void authService.restore().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (ready && user) router.replace(dashboardPath(user));
  }, [ready, user, router]);

  if (!ready || user) return <Loader fullPage label="Checking your session…" />;
  return children;
}
