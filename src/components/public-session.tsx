'use client';

import Link from 'next/link';
import { UserRound } from 'lucide-react';
import { createContext, useContext, useEffect, useState } from 'react';
import { authService, useSession } from '@/store/session';
import type { User } from '@/types';

const PublicSession = createContext<{ user: User | null; ready: boolean }>({
  user: null,
  ready: false,
});

export function PublicSessionProvider({ children }: { children: React.ReactNode }) {
  const user = useSession((state) => state.user);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    setMounted(true);
    void authService.restore().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <PublicSession.Provider
      value={{ user: mounted ? user : null, ready: mounted && (!!user || ready) }}
    >
      {children}
    </PublicSession.Provider>
  );
}

export function usePublicSession() {
  return useContext(PublicSession);
}

export function PublicStartLink({
  href,
  className,
  children,
  iconOnly = false,
}: {
  href: string;
  className?: string;
  children?: React.ReactNode;
  iconOnly?: boolean;
}) {
  const { user, ready } = usePublicSession();
  if (!ready)
    return (
      <span className={className} aria-busy="true">
        Checking session…
      </span>
    );
  return (
    <Link
      href={user ? (user.isAdmin ? '/admin/dashboard' : `/${user.role}/dashboard`) : href}
      className={className}
      aria-label={user && iconOnly ? 'Go to dashboard' : undefined}
      title={user && iconOnly ? 'Go to dashboard' : undefined}
    >
      {user ? (
        <>
          <UserRound size={iconOnly ? 20 : 17} aria-hidden="true" />
          {!iconOnly && ' Go to dashboard'}
        </>
      ) : (
        children
      )}
    </Link>
  );
}
