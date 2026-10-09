import type { Notification, Role } from '@/types';

export function notificationHref(notification: Notification, role: Role): string {
  const base = `/${role}`;
  // Only follow destinations inside the signed-in role's workspace.
  if (notification.href?.startsWith(`${base}/`) && !/[\\\s]/.test(notification.href))
    return notification.href;

  const topic = `${notification.type} ${notification.title} ${notification.body}`.toLowerCase();
  if (/recruiter request|recruitment access|campus request/.test(topic))
    return `${base}/${role === 'campus' ? 'recruiters' : 'campuses'}`;
  if (/offer|joining/.test(topic)) return `${base}/offers`;
  if (/assignment|application|shortlist|round result/.test(topic)) return `${base}/applications`;
  if (/interview/.test(topic)) return `${base}/interviews`;
  if (/assessment/.test(topic)) return `${base}/assessments`;
  if (/document|resume/.test(topic)) return `${base}/documents`;
  if (/drive|placement|schedule/.test(topic))
    return `${base}/${role === 'student' ? 'opportunities' : 'drives'}`;
  if (/learning|skill/.test(topic)) return `${base}/learning`;
  return `${base}/dashboard`;
}
