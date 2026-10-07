'use client';
import { useHydratedReducedMotion } from '@/hooks/use-hydrated-reduced-motion';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
const stages = [
  {
    title: 'Company requests a visit.',
    description:
      'Select a campus. Share the role, eligibility, selection rounds, preferred dates, and infrastructure needs.',
    color: 'lavender',
    href: '/for-recruiters',
    action: 'For recruiters',
  },
  {
    title: 'Campus coordinates the drive.',
    description:
      'The placement cell reviews the request, reserves resources, and proposes a schedule for recruiter confirmation.',
    color: 'pink',
    href: '/for-campuses',
    action: 'For placement cells',
  },
  {
    title: 'Eligible students take their shot.',
    description:
      'After campus finalization and activation, eligibility is checked before matching. Students can then apply.',
    color: 'yellow',
    href: '/for-students',
    action: 'For students',
  },
  {
    title: 'Meet on campus. Move forward.',
    description:
      'The company visits for assessments and interviews. Track selection, offers, documents, and joining in one place.',
    color: 'sage',
    href: '/how-it-works',
    action: 'The complete journey',
  },
];
export function CampusOperation() {
  const reduced = useHydratedReducedMotion();
  return (
    <section className="campus-operation content-width" aria-label="On-campus recruitment workflow">
      <span className="campus-kicker">REAL VISITS. CLEAR RESPONSIBILITIES.</span>
      <div className="section-heading">
        <h2>
          Opportunity comes
          <br />
          to your campus.
        </h2>
        <p>
          Students prepare continuously.
          <br />
          The placement cell coordinates the real drive.
        </p>
      </div>
      <div className="operation-cards">
        {stages.map((s, i) => (
          <motion.article
            key={s.title}
            className={s.color}
            initial={{ opacity: reduced ? 1 : 0, y: reduced ? 0 : 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : i * 0.1 }}
          >
            <span>{String(i + 1).padStart(2, '0')}</span>
            <h3>{s.title}</h3>
            <p>{s.description}</p>
            <Link className="text-link" href={s.href}>
              {s.action} <ArrowUpRight size={15} />
            </Link>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
