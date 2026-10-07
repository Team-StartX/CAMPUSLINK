import { mockAdapter } from '@/mocks/adapter';
import { reactQuestions } from '@/mocks/data';
import { canAccess } from '@/utils/permissions';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applicationService,
  assessmentService,
  contestService,
  interviewService,
  offerService,
  recruiterService,
  studentService,
} from './platform.domain';
beforeEach(() => mockAdapter.reset());
describe('critical placement workflows', () => {
  it('tracks deferred acceptance, withdrawal and notifications without invalid transitions', async () => {
    const id = (await mockAdapter.read()).offers.find((o) => o.status === 'Received')!.id;
    await offerService.respond(id, 'Deferred');
    await offerService.respond(id, 'Accepted');
    await offerService.respond(id, 'Withdrawn');
    const d = await mockAdapter.read();
    expect(d.offers.find((o) => o.id === id)?.status).toBe('Withdrawn');
    expect(d.notifications[0].title).toContain('Withdrawn');
    await expect(offerService.respond(id, 'Joined')).rejects.toThrow('unavailable');
  });
  it('saves and removes the portrait used by the automatic student ID', async () => {
    const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
    await studentService.updatePhoto(photo);
    expect((await studentService.getDashboard()).student.photo).toBe(photo);
    await studentService.updateStudent({ name: 'Sachin Dash' });
    const updated = (await studentService.getDashboard()).student;
    expect(updated.name).toBe('Sachin Dash');
    expect(updated.photo).toBe(photo);
    await studentService.updatePhoto();
    expect((await studentService.getDashboard()).student.photo).toBeUndefined();
  });
  it('rejects unsupported or oversized ID photos without changing the profile', async () => {
    await expect(studentService.updatePhoto('data:text/html;base64,PHNjcmlwdD4=')).rejects.toThrow(
      'PNG',
    );
    await expect(
      studentService.updatePhoto('data:image/png;base64,' + 'A'.repeat(2000001)),
    ).rejects.toThrow('2 MB');
    expect((await studentService.getDashboard()).student.photo).toBeUndefined();
  });
  it('creates an unverified skill and a unified verification assessment', async () => {
    const data = await studentService.addSkill('Docker', 'Beginner');
    expect(data.student.skills.find((s) => s.name === 'Docker')?.verified).toBe(false);
    expect(data.assessments.find((a) => a.skill === 'Docker')?.type).toBe('Skill');
    await expect(studentService.addSkill('docker', 'Beginner')).rejects.toThrow('already');
  });
  it('verifies a passed skill, records history, and awards points', async () => {
    const result = await assessmentService.submitAssessment(
      'react',
      reactQuestions.map((q) => q.answer),
      120,
    );
    const data = await mockAdapter.read();
    expect(result.score).toBe(100);
    expect(data.student.skills.find((s) => s.name === 'React')?.verified).toBe(true);
    expect(data.student.xp).toBe(2600);
    expect(data.history[0].id).toBe(result.id);
  });
  it('does not verify failed skill assessments', async () => {
    const result = await assessmentService.submitAssessment('react', Array(10).fill(-1), 600);
    expect(result.score).toBe(0);
    expect(result.points).toBe(0);
    expect(
      (await mockAdapter.read()).student.skills.find((s) => s.name === 'React')?.verified,
    ).toBe(false);
  });
  it('submits an application once and adds a notification', async () => {
    const d = await applicationService.apply('razorpay');
    expect(d.applications.filter((a) => a.opportunityId === 'razorpay')).toHaveLength(1);
    expect(d.notifications[0].type).toBe('Application');
    await expect(applicationService.apply('razorpay')).rejects.toThrow('already');
  });
  it('awards contest points only once', async () => {
    await contestService.joinContest('weekly');
    await contestService.submitContest('weekly', '32');
    await contestService.submitContest('weekly', '32');
    expect((await mockAdapter.read()).student.xp).toBe(2630);
  });
  it('rejects interview schedule collisions', async () => {
    await expect(
      interviewService.schedule({
        company: 'TCS',
        role: 'Engineer',
        date: '2026-10-06',
        time: '11:00',
        mode: 'Online',
        round: 'Technical',
      }),
    ).rejects.toThrow('conflict');
  });
  it('submits a complete campus request without publishing', async () => {
    await recruiterService.createDrive({
      campusId: 'dtu',
      courses: 'B.Tech',
      branches: 'CSE',
      graduationYear: '2027',
      deadline: '2026-10-12',
      preferredDates: ['2026-10-18'],
      company: 'Acme',
      role: 'Engineer',
      location: 'Remote',
      ctc: '12 LPA',
      vacancies: 3,
      description: 'Build reliable applications.',
      cgpa: 7,
      skills: 'React',
      status: 'SUBMITTED',
    });
    await expect(interviewService.completePractice()).rejects.toThrow(
      'authenticated practice session',
    );
    const d = await mockAdapter.read();
    expect(d.drives.at(-1)?.status).toBe('SUBMITTED');
    expect(d.opportunities.some((o) => o.company === 'Acme')).toBe(false);
    expect(d.student.xp).toBe(2480);
  });
});
describe('profile and access integration', () => {
  it('guards workspaces by role', () => {
    const user = {
      id: 'u1',
      name: 'Student',
      email: 'student@example.edu',
      role: 'student' as const,
    };
    expect(canAccess(user, 'student')).toBe(true);
    expect(canAccess(user, 'recruiter')).toBe(false);
    expect(canAccess(null, 'campus')).toBe(false);
  });
  it('uses skill-specific question banks when verifying AWS', async () => {
    const attempt = await assessmentService.startAssessment('skill-aws');
    expect(attempt.questions[0].prompt).toContain('virtual servers');
    const result = await assessmentService.submitAssessment(
      'skill-aws',
      attempt.questions.map((q) => q.answer),
      150,
    );
    expect(result.score).toBe(100);
    expect((await mockAdapter.read()).student.skills.find((s) => s.name === 'AWS')?.verified).toBe(
      true,
    );
  });
  it('reuses published interview template questions', async () => {
    await interviewService.createTemplate({
      name: 'Backend practice',
      targetRole: 'Backend Developer',
      difficulty: 'Intermediate',
      duration: 25,
      skills: 'SQL, Node.js',
      topics: 'Databases',
      questions: ['Question one', 'Question two', 'Question three'],
      audience: 'Applicants',
    });
    const template = (await mockAdapter.read()).interviewTemplates![0];
    const practice = await interviewService.startAIInterview(template.id);
    expect(practice.questions).toEqual(template.questions);
  });
  it('updates profile completeness from saved profile sections', async () => {
    await studentService.updateStudent({
      records: {
        Experience: ['Engineering internship'],
        Certifications: ['AWS certificate'],
        'Professional links': ['Portfolio'],
      },
    });
    expect((await studentService.getDashboard()).student.profileCompletion).toBe(100);
  });
});
