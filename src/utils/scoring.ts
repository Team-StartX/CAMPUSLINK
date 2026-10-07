import { AssessmentAttempt, WorkspaceData, Drive, Student } from '@/types';
import { checkEligibility } from './placement';

const average = (values: number[]) =>
  values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
const level = (score: number) =>
  score >= 85
    ? 'Highly Employable'
    : score >= 70
      ? 'Ready'
      : score >= 45
        ? 'Developing'
        : 'Not Ready';
export function readiness(student: Student, history: AssessmentAttempt[] = []) {
  const attemptScore = (types: string[]) =>
    average(
      history
        .filter((h) => types.some((t) => h.type.toLowerCase().includes(t)))
        .map((h) => h.score),
    );
  const hasAttempt = (types: string[]) =>
    history.some((h) => types.some((t) => h.type.toLowerCase().includes(t)));
  const categories = [
    {
      name: 'Verified skills',
      score: student.skills.length
        ? Math.round(
            (100 * student.skills.filter((s) => s.verified).length) / student.skills.length,
          )
        : 0,
      weight: 0.3,
      recorded: student.skills.length > 0,
    },
    {
      name: 'Academics',
      score: Math.min(100, Math.max(0, student.cgpa * 10 - (student.activeBacklogs || 0) * 10)),
      weight: 0.2,
      recorded: student.cgpa > 0,
    },
    {
      name: 'Projects',
      score: Math.min(100, student.projects.length * 35),
      weight: 0.15,
      recorded: student.projects.length > 0,
    },
    {
      name: 'Aptitude',
      score: attemptScore(['aptitude']),
      weight: 0.15,
      recorded: hasAttempt(['aptitude']),
    },
    {
      name: 'Communication',
      score: attemptScore(['communication', 'soft']),
      weight: 0.1,
      recorded: hasAttempt(['communication', 'soft']),
    },
    {
      name: 'Interview',
      score: attemptScore(['interview']),
      weight: 0.1,
      recorded: hasAttempt(['interview']),
    },
  ];
  const score = Math.round(categories.reduce((sum, c) => sum + c.score * c.weight, 0));
  return {
    score,
    label: level(score),
    categories,
    factors: categories
      .filter((c) => c.score < 60)
      .map((c) => `${c.name}: ${c.score}/100${c.score === 0 ? ' · no recorded evidence yet' : ''}`),
  };
}
export function fit(student: Student, drive: Drive, history: AssessmentAttempt[] = []) {
  const eligibility = checkEligibility(student, drive);
  const required = drive.skills
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const skills = required.map((name) => ({
    name,
    skill: student.skills.find((s) => s.name.toLowerCase() === name.toLowerCase()),
  }));
  const alignment = required.length
    ? Math.round(
        (100 * skills.reduce((sum, s) => sum + (s.skill?.verified ? 1 : s.skill ? 0.5 : 0), 0)) /
          required.length,
      )
    : 100;
  const words = required.map((s) => s.toLowerCase());
  const projects = student.projects.filter((p) =>
    words.some((w) => `${p} ${student.projectDescriptions?.[p] || ''}`.toLowerCase().includes(w)),
  ).length;
  const explanation = [
    { name: 'Skill alignment', score: alignment, weight: 0.45 },
    { name: 'Assessment performance', score: average(history.map((h) => h.score)), weight: 0.2 },
    { name: 'Project relevance', score: Math.min(100, projects * 50), weight: 0.15 },
    {
      name: 'Certifications',
      score: Math.min(100, (student.records?.Certifications?.length || 0) * 50),
      weight: 0.05,
    },
    { name: 'Academics', score: Math.min(100, student.cgpa * 10), weight: 0.15 },
  ];
  const score = eligibility.passed
    ? Math.round(explanation.reduce((sum, c) => sum + c.score * c.weight, 0))
    : 0;
  return {
    score,
    label: eligibility.passed ? level(score) : 'Eligibility not met',
    explanation,
    eligibility,
    gaps: skills
      .filter((s) => !s.skill?.verified)
      .map((s) => ({
        name: s.name,
        action: s.skill
          ? 'Verify this skill through an assessment'
          : 'Learn the fundamentals and add a project',
      })),
  };
}
export function placementSummary(data: WorkspaceData) {
  const accepted = data.offers.filter((o) => ['Accepted', 'Joined'].includes(o.status));
  const packages = data.offers
    .map((o) => Number(o.ctc.match(/[\d.]+/)?.[0] || 0))
    .filter((n) => n > 0);
  const ready = readiness(data.student, data.history);
  return {
    registered: 1,
    ready: ready.score >= 70 ? 1 : 0,
    readiness: ready,
    offers: data.offers.length,
    accepted: accepted.length,
    pending: data.offers.filter((o) => ['Received', 'Deferred'].includes(o.status)).length,
    joined: data.offers.filter((o) => o.status === 'Joined').length,
    active: data.drives.filter((d) => ['ACTIVE', 'IN_PROGRESS'].includes(d.status)).length,
    upcoming: data.drives.filter((d) =>
      ['CONFIRMED', 'AWAITING_RECRUITER_CONFIRMATION'].includes(d.status),
    ).length,
    verified: data.documents.filter((d) => d.status === 'Verified').length,
    documents: data.documents.length,
    average: average(packages),
    highest: Math.max(0, ...packages),
    atRisk: !accepted.length && ready.score < 70,
    conversion: accepted.length ? 100 : 0,
  };
}
