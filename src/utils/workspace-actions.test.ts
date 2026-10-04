import { describe, expect, it } from 'vitest';
import { actionCalendar, workspaceActions } from './workspace-actions';
import { mockAdapter } from '@/mocks/adapter';

describe('role action center', () => {
  it('excludes expired and already applied opportunities', async () => {
    const data = await mockAdapter.read();
    data.opportunities = [
      { ...data.opportunities[0], id: 'expired', deadline: '2026-10-01' },
      { ...data.opportunities[0], id: 'applied', deadline: '2026-10-20' },
    ];
    data.applications = [
      { id: 'a', opportunityId: 'applied', stage: 'Applied', date: '2026-10-04' },
    ];
    expect(
      workspaceActions(data, 'student', '2026-10-04').some((a) => a.category === 'Applications'),
    ).toBe(false);
  });
  it('routes confirmation to recruiter and review to campus only', async () => {
    const data = await mockAdapter.read();
    data.drives = [
      { ...data.drives[0], id: 'review', status: 'SUBMITTED' },
      { ...data.drives[0], id: 'confirm', status: 'AWAITING_RECRUITER_CONFIRMATION' },
    ];
    expect(
      workspaceActions(data, 'campus', '2026-10-04')
        .filter((a) => a.category === 'Drives')
        .map((a) => a.id),
    ).toEqual(['drive-review']);
    expect(
      workspaceActions(data, 'recruiter', '2026-10-04')
        .filter((a) => a.category === 'Drives')
        .map((a) => a.id),
    ).toEqual(['drive-confirm']);
  });
  it('exports dated events with escaped content and an exclusive end date', () => {
    const result = actionCalendar(
      [
        {
          id: 'one',
          title: 'Acme, Inc; interview',
          detail: 'Round 1\nOnline',
          category: 'Interviews',
          href: '/student/interviews',
          date: '2026-12-31',
          priority: 'High',
        },
      ],
      new Date('2026-10-04T00:00:00Z'),
    );
    expect(result).toContain('DTEND;VALUE=DATE:20270101');
    expect(result).toContain('SUMMARY:Acme\\, Inc\\; interview');
    expect(result).toContain('DESCRIPTION:Round 1\\nOnline');
  });
});
