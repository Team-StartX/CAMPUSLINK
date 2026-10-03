'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { studentService } from '@/services/platform.service';
import { useSession } from '@/store/session';
import { backendEnabled } from '@/services/api/remote';
export function usePlatform() {
  const user = useSession((s) => s.user);
  const query = useQuery({
    queryKey: ['platform', user?.id],
    queryFn: studentService.getDashboard,
    enabled: !backendEnabled || Boolean(user && user.onboardingComplete !== false),
    retry: 1,
  });
  const client = useQueryClient();
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['readiness'] });
    return client.invalidateQueries({ queryKey: ['platform'] });
  };
  return { ...query, refresh };
}
