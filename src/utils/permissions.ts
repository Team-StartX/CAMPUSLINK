import { Role, User } from '@/types';
export function dashboardPath(user: User): string {
  return user.isAdmin ? '/admin/dashboard' : `/${user.role}/dashboard`;
}

// Controls client navigation visibility; the backend enforces authorization.
export function canAccess(user: User | null, role: Role): boolean {
  return user?.role === role;
}
