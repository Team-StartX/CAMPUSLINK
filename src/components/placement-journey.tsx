import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
const stages = [
  {
    title: 'Create your account',
    description:
      'Register your institution or company. Students join a registered campus. Verify your email and complete your profile.',
    href: '/register',
    action: 'Create account',
  },
  {
    title: 'Build preparation evidence',
    description:
      'Add projects and skills, complete assessments, and review feedback from your practice answers.',
    href: '/student/profile',
    action: 'Open career profile',
  },
  {
    title: 'Publish a campus drive',
    description:
      'Recruiters submit a role and eligibility criteria. Campus teams review the request, agree a schedule, and activate the drive.',
    href: '/recruiter/drives/request',
    action: 'Request a drive',
  },
  {
    title: 'Check eligibility and apply',
    description:
      'Students see active campus opportunities, eligibility checks, and evidence explaining their fit before submitting an application.',
    href: '/student/opportunities',
    action: 'View opportunities',
  },
  {
    title: 'Track interviews and selection',
    description:
      'Recruiters and campus teams record shortlist decisions, schedules, attendance, and selection progress.',
    href: '/student/applications',
    action: 'Track applications',
  },
  {
    title: 'Manage offers and joining',
    description:
      'Review issued offers, submit required documents, and follow verification and joining progress in your workspace.',
    href: '/student/offers',
    action: 'View offers',
  },
];
export function PlacementJourney() {
  return (
    <section
      className="content-width"
      id="placement-journey"
      aria-labelledby="placement-journey-title"
      style={{ paddingBlock: '5rem' }}
    >
      <span className="eyebrow">FROM CAMPUS TO CAREER</span>
      <h2 id="placement-journey-title">Your placement journey, in one workspace.</h2>
      <p>Each step follows your account, preparation evidence, and campus placement records.</p>
      <div className="three-columns">
        {stages.map((stage, index) => (
          <section className="panel" key={stage.title}>
            <span className="eyebrow">0{index + 1}</span>
            <h3>{stage.title}</h3>
            <p>{stage.description}</p>
            <Link href={stage.href} className="text-link">
              {stage.action} <ArrowUpRight size={16} />
            </Link>
          </section>
        ))}
      </div>
    </section>
  );
}
