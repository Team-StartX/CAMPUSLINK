'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { useEffect, useState } from 'react';
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 10000, retry: 1 } } }),
  );
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('campuslink-preferences') || '{}');
      setReduced(!!saved.reduced);
      document.documentElement.classList.toggle('reduce-motion', !!saved.reduced);
    } catch {}
    const change = (event: Event) => {
      const detail = (event as CustomEvent<{ reduced: boolean }>).detail;
      setReduced(detail.reduced);
      document.documentElement.classList.toggle('reduce-motion', detail.reduced);
    };
    window.addEventListener('campuslink-motion', change);
    return () => window.removeEventListener('campuslink-motion', change);
  }, []);
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>{children}</MotionConfig>
    </QueryClientProvider>
  );
}
