'use client';
import { useHydratedReducedMotion } from '@/hooks/use-hydrated-reduced-motion';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowUpRight, BadgeCheck } from 'lucide-react';
import { Role } from '@/types';
const roles = {
  student: {
    label: 'Student',
    title: 'Your potential. Your next chapter.',
    action: 'Learn → Prepare → Get placed',
    detail: 'Build a profile that opens doors.',
  },
  recruiter: {
    label: 'Recruiter',
    title: 'Great talent. Closer than ever.',
    action: 'Discover → Schedule → Hire',
    detail: 'Meet the right people, on campus.',
  },
  campus: {
    label: 'Campus team',
    title: 'One campus. More possibilities.',
    action: 'Coordinate → Connect → Celebrate',
    detail: 'Bring every placement step together.',
  },
};
export function RoleJourney({ role }: { role: Role }) {
  const reduced = useHydratedReducedMotion(),
    content = roles[role];
  return (
    <motion.div
      key={role}
      className={`auth-role-visual ${role}`}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="auth-portrait-orbit" aria-hidden="true" />
      <div className="auth-role-title">
        <span className="eyebrow">FOR EVERY NEXT CHAPTER</span>
        <h2>{content.title}</h2>
      </div>
      <Image
        className="auth-role-cutout"
        src={`/images/auth-${role}.png`}
        alt={`${content.label} portrait`}
        width={1024}
        height={1400}
        priority
      />
      <div className="auth-portrait-note">
        <BadgeCheck size={19} />
        <div>
          <b>{content.label}</b>
          <span>{content.detail}</span>
        </div>
        <ArrowUpRight size={18} />
      </div>
      <div className="auth-role-caption">
        <b>{content.action}</b>
        <p>{content.detail}</p>
      </div>
    </motion.div>
  );
}
