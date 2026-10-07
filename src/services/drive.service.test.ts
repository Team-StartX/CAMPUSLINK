import { mockAdapter } from '@/mocks/adapter';
import { DriveSchedule } from '@/types';
import { checkEligibility } from '@/utils/placement';
import { beforeEach, describe, expect, it } from 'vitest';
import { driveService } from './drive.domain';
import { applicationService, matchingService, studentService } from './platform.domain';

beforeEach(() => mockAdapter.reset());
const schedule: DriveSchedule = {
  date: '2026-10-26',
  reporting: '08:30',
  talk: '09:00',
  assessment: '10:00',
  interviews: '13:00',
  end: '17:00',
  venue: 'Hall A',
  lab: 'Lab A',
  rooms: 'Rooms A–C',
  systems: 60,
};
describe('campus-controlled placement lifecycle', () => {
  it('keeps a request hidden through confirmation and exposes it only after campus finalization and activation', async () => {
    const id = 'request-acme';
    const absent = async () =>
      expect((await driveService.getCampusOpportunities()).some((o) => o.driveId === id)).toBe(
        false,
      );
    await absent();
    await expect(applicationService.apply(id)).rejects.toThrow('not open');
    await driveService.transition(id, 'review', 'campus');
    await driveService.transition(id, 'approve', 'campus');
    await absent();
    await driveService.proposeSchedule(id, schedule);
    await absent();
    await driveService.transition(id, 'confirm', 'recruiter');
    await absent();
    await expect(driveService.transition(id, 'activate', 'campus')).rejects.toThrow('Finalize');
    await driveService.transition(id, 'finalize', 'campus');
    await driveService.transition(id, 'activate', 'campus');
    expect((await driveService.getCampusOpportunities()).some((o) => o.driveId === id)).toBe(true);
    await applicationService.apply(id);
    expect((await mockAdapter.read()).applications.some((a) => a.opportunityId === id)).toBe(true);
  });
  it('rejects role-inappropriate and out-of-order transitions', async () => {
    await expect(driveService.transition('request-acme', 'activate', 'campus')).rejects.toThrow(
      'not available',
    );
    await expect(driveService.transition('request-acme', 'approve', 'recruiter')).rejects.toThrow(
      'not available',
    );
    await expect(driveService.proposeSchedule('request-acme', schedule)).rejects.toThrow(
      'approved',
    );
  });
  it('supports changes, revisions, and resubmission without student publication', async () => {
    await driveService.transition(
      'request-acme',
      'changes',
      'campus',
      'Clarify the required skills.',
    );
    await driveService.updateDriveRequest('request-acme', { skills: 'React, SQL, Node.js' });
    await driveService.transition('request-acme', 'resubmit', 'recruiter');
    expect((await driveService.getDrive('request-acme'))?.status).toBe('SUBMITTED');
    expect(
      (await driveService.getCampusOpportunities()).some((o) => o.company === 'Acme Technologies'),
    ).toBe(false);
  });
  it('checks every hard eligibility field before demo matching or application', async () => {
    const data = await mockAdapter.read();
    const drive = data.drives.find((d) => d.opportunityId === 'razorpay')!;
    expect(checkEligibility(data.student, drive).passed).toBe(true);
    for (const patch of [
      { campus: 'Another campus' },
      { course: 'MBA · Management' },
      { branch: 'ME' },
      { year: '2029' },
      { cgpa: 5 },
      { activeBacklogs: 2 },
    ]) {
      expect(checkEligibility({ ...data.student, ...patch }, drive).passed).toBe(false);
    }
    await studentService.updateStudent({ cgpa: 5 });
    expect(await driveService.getCampusOpportunities()).toHaveLength(0);
    await expect(matchingService.getMatchExplanation('razorpay')).rejects.toThrow('eligible');
    await expect(applicationService.apply('razorpay')).rejects.toThrow('eligibility');
  });
  it('detects resource and cohort conflicts before sending a schedule', async () => {
    await driveService.transition('request-acme', 'approve', 'campus');
    await expect(
      driveService.proposeSchedule('request-acme', {
        ...schedule,
        date: '2026-10-18',
        venue: 'Placement Block · Hall 1',
      }),
    ).rejects.toThrow('conflict');
    await expect(
      driveService.proposeSchedule('request-acme', { ...schedule, systems: 1 }),
    ).rejects.toThrow('60');
    await expect(
      driveService.proposeSchedule('request-acme', { ...schedule, end: '07:00' }),
    ).rejects.toThrow();
  });
  it('removes cancelled drives from both opportunities and matching', async () => {
    await driveService.transition(
      'drive-1',
      'cancel',
      'campus',
      'Campus visit cancelled by the placement cell.',
    );
    expect(
      (await studentService.getDashboard()).opportunities.some((o) => o.id === 'razorpay'),
    ).toBe(false);
    await expect(applicationService.apply('razorpay')).rejects.toThrow('not open');
  });
  it('tracks attendance and sequential cleared rounds with valid counts', async () => {
    await driveService.transition('drive-1', 'start', 'campus');
    await driveService.updateAttendance('drive-1', 100);
    const round = (await driveService.getDrive('drive-1'))!.rounds![0];
    await driveService.updateRound('drive-1', round.id, 80);
    await expect(driveService.updateRound('drive-1', round.id, 101)).rejects.toThrow(
      'cannot exceed',
    );
    await driveService.transition('drive-1', 'complete', 'campus');
    expect((await driveService.getDrive('drive-1'))?.status).toBe('COMPLETED');
  });
});
