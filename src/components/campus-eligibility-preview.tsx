'use client';

import { useQuery } from '@tanstack/react-query';
import { campusService } from '@/services/platform.service';
import { useSession } from '@/store/session';
import type { Drive } from '@/types';
import { checkEligibility } from '@/utils/placement';
import { Badge, Button } from './ui';

export function CampusEligibilityPreview({ drive }: { drive: Drive }) {
  const userId = useSession((state) => state.user?.id);
  const query = useQuery({
    queryKey: ['people', 'campus', userId],
    queryFn: campusService.getStudents,
    enabled: Boolean(userId),
    refetchInterval: 15000,
  });
  const rows = (query.data || []).map((student) => ({
    student,
    eligibility: checkEligibility(student, drive),
  }));
  const eligible = rows.filter((row) => row.eligibility.passed).length;
  return (
    <section className="panel">
      <h2>College students & placement eligibility</h2>
      <p>
        Eligibility uses this placement’s course, branch, graduation year, CGPA, backlogs, and
        required skills. Preferred skills help rank eligible students.
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
          {rows.map(({ student, eligibility }) => (
            <details key={student.id}>
              <summary>
                {student.name}{' '}
                <Badge kind={eligibility.passed ? 'verified' : ''}>
                  {eligibility.passed ? 'Eligible' : 'Not eligible'}
                </Badge>
              </summary>
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
