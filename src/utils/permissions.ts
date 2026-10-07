import { Role, User } from '@/types';
// Controls client navigation visibility; the backend enforces authorization.
export function canAccess(user: User | null, role: Role): boolean {
  return user?.role === role;
}
