import { Role, User } from '@/types';
// Client demo guard only. Real authorization belongs to the backend.
export function canAccess(user: User | null, role: Role): boolean {
  return user?.role === role;
}
