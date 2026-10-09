'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api/client';
import { useSession } from '@/store/session';
import type { Drive } from '@/types';
import type { Student } from '@/types';
import type { fit } from '@/utils/scoring';
import { Badge, Button } from './ui';

export function CampusEligibilityPreview({ drive }: { drive: Drive }) {
  const userId = useSession((state) => state.user?.id);
  const query = useQuery<(ReturnType<typeof fit> & { student: Student; hybridScore: number })[]>({
    queryKey: ['candidate-ranking', drive.id, userId],
    queryFn: async () => (await apiClient.get(`/drives/${drive.id}/matches`)).data,
    enabled: Boolean(userId),
    refetchInterval: 15000,
  });
  const rows = query.data || [];
  const eligible = rows.filter((row) => row.eligibility.passed).length;
  return (
    <section className="panel">
      <h2>Smart matching & student skill gaps</h2>
      <p>
        Matches update automatically from student profiles and this job’s requirements. Review
        eligibility, ranked fit and preparation gaps below.
      </p>
      {query.isPending ? (
        <p role="status">Loading college students…</p>
      ) : query.error ? (
        <>
          <p role="alert">{query.error.message}</p>
          <Button onClick={() => void query.refetch()}>Retry</Button>
        </>
      ) : (
        <>
          <p>
            {rows.length} students · {eligible} eligible · {rows.length - eligible} not eligible
          </p>
          {!rows.length && <p>No registered students are linked to your college yet.</p>}
          {rows.map(({ student, eligibility, gaps, hybridScore }) => (
            <details key={student.id}>
              <summary>
                {student.name} <span>{hybridScore}% fit · </span>
                <Badge kind={eligibility.passed ? 'verified' : ''}>
                  {eligibility.passed ? 'Eligible' : 'Not eligible'}
                </Badge>
              </summary>
              <p>
                CGPA: {student.cgpa} · Skills:{' '}
                {student.skills.map((skill) => skill.name).join(', ') || 'Not recorded'}
              </p>
              <h3>Skill gaps & next steps</h3>
              {gaps.map((gap) => (
                <p key={gap.name}>
                  <b>{gap.name}</b> · {gap.action}
                </p>
              ))}
              {!gaps.length && <p>Required skills are recorded and verified.</p>}
              {eligibility.checks.map((check) => (
                <p key={check.name}>
                  {check.passed ? '✓' : '✗'} {check.name}: {check.detail}
                </p>
              ))}
            </details>
          ))}
        </>
      )}
    </section>
  );
}
