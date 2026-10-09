import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app';
import { Database } from '../server/db';
import { Authentication } from '../server/auth';
import { config } from '../server/config';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const db = new Database('', ':memory:');
  const { app } = await createApp(db);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  const auth = new Authentication(db);
  const storageDir = fs.mkdtempSync(path.resolve('tmp/form-uploads-'));
  const originalStorage = { storage: config.storage, storageDir: config.storageDir };
  Object.assign(config, { storage: 'local', storageDir });
  type Session = {
    cookie: string;
    csrf: string;
    user: { id: string; email: string; campusId: string };
  };
  let checks = 0;
  async function request(
    path: string,
    body: unknown,
    session?: Session,
    method = 'POST',
    expected = 200,
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: config.origin,
        ...(session ? { Cookie: session.cookie, 'X-CSRF-Token': session.csrf } : {}),
      },
      ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
    checks++;
    return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
  }
  async function register(role: 'campus' | 'student' | 'recruiter') {
    const { data, cookie } = await request(
      '/auth/register',
      {
        name: `${role} Test`,
        email: `${role}@example.test`,
        password: 'Form-test-password-123',
        role,
        institution: 'Form Test Campus',
        ...(role === 'student' ? { course: 'BTech', branch: 'CSE', year: '2027' } : {}),
      },
      undefined,
      'POST',
      201,
    );
    const account = (await auth.byId(data.user.id))!;
    account.approved = true;
    account.isAdmin = role === 'campus';
    await auth.save(account);
    return { ...data, cookie } as Session;
  }
  const rpc = (
    session: Session,
    service: string,
    method: string,
    args: unknown[],
    expected = 200,
  ) => request(`/services/${service}/${method}`, { args }, session, 'POST', expected);
  try {
    const campus = await register('campus');
    const student = await register('student');
    const recruiter = await register('recruiter');
    await request(
      '/auth/login',
      { email: student.user.email, password: 'wrong' },
      undefined,
      'POST',
      401,
    );
    await request('/auth/login', { email: student.user.email, password: 'Form-test-password-123' });
    const account = (await auth.byId(student.user.id))!;
    account.onboardingComplete = false;
    await auth.save(account);
    await request(
      '/account/onboarding',
      {
        name: 'Student Form Test',
        institution: 'Form Test Campus',
        campusId: campus.user.campusId,
        course: 'BTech',
        branch: 'CSE',
        year: '2027',
        cgpa: 8.25,
        bio: 'Test profile',
      },
      student,
      'PUT',
    );
    await rpc(student, 'studentService', 'updateStudent', [
      {
        name: 'Edited Student',
        cgpa: 8.75,
        activeBacklogs: 0,
        branch: 'CSE',
        course: 'BTech',
        year: '2027',
        bio: 'Edited biography',
      },
    ]);
    await rpc(student, 'studentService', 'updateStudent', [{ email: 'changed@example.test' }], 400);
    await rpc(student, 'studentService', 'updateStudent', [
      {
        projects: ['Form test project'],
        projectDescriptions: { 'Form test project': 'Description saved from project form' },
        records: {
          Experience: ['Internship'],
          Certifications: ['SQL certification'],
          'Professional links': ['https://example.test'],
          Achievements: ['Project award'],
        },
      },
    ]);
    await rpc(campus, 'campusService', 'updateStudent', [
      student.user.id,
      { bio: 'Campus corrected profile' },
    ]);
    await rpc(student, 'studentService', 'addSkill', ['SQL', 'Intermediate']);
    const upload = new FormData();
    upload.append('type', 'Resume');
    upload.append('file', new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' }), 'form-test.pdf');
    const uploadResponse = await fetch(base + '/documents', { method: 'POST', headers: { Origin: config.origin, Cookie: student.cookie, 'X-CSRF-Token': student.csrf }, body: upload });
    assert.equal(uploadResponse.status, 201);
    checks++;
    const uploaded = await uploadResponse.json();
    const documentId = uploaded.documents.at(-1).id;
    const download = await fetch(base + `/documents/${documentId}/download`, { headers: { Cookie: student.cookie } });
    assert.equal(download.status, 200);
    assert.equal(await download.text(), '%PDF-1.4\n%%EOF');
    checks++;
    await rpc(student, 'documentService', 'remove', [documentId]);
    await request(
      '/organization',
      {
        name: 'Form Test Company',
        description: 'Company profile',
        industry: 'Software',
        headquarters: 'Delhi',
        website: 'https://example.test',
        logo: '',
        size: '20',
      },
      recruiter,
      'PUT',
    );
    assert.equal(
      (await request('/organization', undefined, recruiter, 'GET')).data.name,
      'Form Test Company',
    );
    await request('/organization', { name: 'X' }, recruiter, 'PUT', 400);
    const question = (
      await request(
        '/admin/questions',
        { prompt: 'What is two plus two?', topic: 'Math', options: ['Four', 'Five'], answer: 0 },
        campus,
      )
    ).data;
    const assessment = (
      await request(
        '/admin/assessments',
        {
          name: 'Form test assessment',
          campusId: campus.user.campusId,
          type: 'Aptitude',
          duration: 15,
          skill: '',
          color: 'lavender',
          status: 'published',
          questionIds: [question.id],
        },
        campus,
      )
    ).data;
    await rpc(student, 'assessmentService', 'startAssessment', [assessment.id]);
    await rpc(student, 'assessmentService', 'submitAssessment', [assessment.id, [0], 30]);
    const contest = (
      await request(
        '/admin/contests',
        {
          name: 'Form test contest',
          campusId: campus.user.campusId,
          type: 'Daily challenge',
          duration: 15,
          points: 20,
          difficulty: 'Easy',
          prompt: 'What is two plus two?',
          answer: '4',
          status: 'published',
        },
        campus,
      )
    ).data;
    await rpc(student, 'contestService', 'joinContest', [contest.id]);
    await rpc(student, 'contestService', 'submitContest', [contest.id, '4']);
    await request(
      '/admin/campuses',
      {
        name: 'Another Test Campus',
        location: 'Delhi',
        studentPool: 0,
        courses: ['BTech'],
        branches: ['CSE'],
      },
      campus,
    );
    await request('/assistant', { question: 'Which drives am I eligible for?' }, student);
    await rpc(recruiter, 'interviewService', 'createTemplate', [
      {
        name: 'Developer practice',
        targetRole: 'Developer',
        difficulty: 'Intermediate',
        duration: 25,
        skills: 'SQL',
        topics: 'Databases',
        questions: ['Explain your project.', 'Explain a database index.', 'Explain an API.'],
        audience: 'Applicants',
      },
    ]);
    await rpc(recruiter, 'interviewService', 'createTemplate', [{ name: 'Invalid' }], 400);
    const practice = (await rpc(student, 'interviewService', 'startAIInterview', [])).data;
    const answers = practice.questions.map(() => 'I built and tested a database project, measured the results and improved the query performance.');
    await rpc(student, 'interviewService', 'completePractice', [answers.slice(1), 60], 400);
    await rpc(student, 'interviewService', 'completePractice', [answers, 60]);
    await rpc(student, 'interviewService', 'completePractice', [answers, 60], 409);
    await request('/auth/forgot-password', { email: student.user.email });
    const jobs = await db.list<{ text: string }>('mail');
    const reset = jobs.find((job) => job.text.includes('/reset-password?token='));
    assert.ok(reset);
    const token = new URL(reset.text).searchParams.get('token');
    await request('/auth/reset-password', { token, password: 'Changed-password-123' });
    await request(
      '/auth/reset-password',
      { token, password: 'Changed-password-456' },
      undefined,
      'POST',
      400,
    );
    await request('/auth/login', { email: student.user.email, password: 'Changed-password-123' });
    console.log(
      `PASS: ${checks} HTTP checks for authentication, onboarding, student/campus edits, projects, profile records, skills, company profile, admin content, assessments, contests, assistant, templates and password reset. Isolated database; no external email or storage writes.`,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
    Object.assign(config, originalStorage);
    if (!storageDir.startsWith(path.resolve('tmp') + path.sep)) throw new Error('Unsafe test path');
    fs.rmSync(storageDir, { recursive: true, force: true });
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
