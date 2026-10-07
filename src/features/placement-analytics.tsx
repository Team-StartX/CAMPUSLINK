'use client';
import { ConnectedAnalytics } from '@/components/backend-tools';
import { WorkspaceData, Role } from '@/types';
export function PlacementAnalytics(_props: { data: WorkspaceData; role: Role; reports?: boolean }) {
  return <ConnectedAnalytics />;
}
