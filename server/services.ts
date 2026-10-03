import { z } from 'zod';
import * as platform from '../src/services/platform.domain';
import { driveService, driveRequestSchema } from '../src/services/drive.domain';
import { mockAdapter } from '../src/mocks/adapter';
import { readiness, fit } from '../src/utils/scoring';
import { checkEligibility } from '../src/utils/placement';
import { currentContext, readWorkspace, studentProfiles, StoredDrive } from './workspace';
import { requireCondition } from './errors';
import { analyzeResumeText, interviewFeedback, parseRequirements, similarity } from './nlp';
import { modelInsight, OutcomeRow } from './ml';
import { coaching } from './generative';
import { downloadFile, uploadFile, detectFile } from './storage';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { randomUUID } from 'node:crypto';
import type { DemoData, Question, Student } from '../src/types';
import { assessmentQuestions } from './admin';
import type { AdminContest } from '../src/types/admin';
import { POINTS } from '../src/config/points.config';
import {
  requestMl,
  placementResponse,
  resumeResponse,
  jobResponse,
  interviewResponse,
  mlIntegration,
  redactMlText,
  extractedNames,
} from './ml-client';

export const policy: Record<string, Record<string, string[]>> = {
  studentService: {
    getDashboard: ['student', 'campus', 'recruiter'],
    updateStudent: ['student'],
    updatePhoto: ['student'],
    addSkill: ['student'],
    removeSkill: ['student'],
    editSkillLevel: ['student'],
    dismissOnboarding: ['student'],
  },
  matchingService: { getRecommendedJobs: ['student'], getMatchExplanation: ['student'] },
  applicationService: {
    apply: ['student'],
    advance: ['campus', 'recruiter'],
    reject: ['campus', 'recruiter'],
  },
  assessmentService: {
    getAssessments: ['student', 'campus', 'recruiter'],
    startAssessment: ['student'],
    submitAssessment: ['student'],
    getAssessmentHistory: ['student'],
  },
  contestService: {
    getContests: ['student', 'campus'],
    joinContest: ['student'],
    submitContest: ['student'],
    getLeaderboard: ['student', 'campus'],
  },
  aiService: {
    getReadinessScore: ['student', 'campus', 'recruiter'],
    getSkillGaps: ['student'],
    parseJobDescription: ['recruiter', 'campus'],
    predictPlacementRisk: ['student', 'campus'],
    analyzeResume: ['student'],
    getCareerRecommendations: ['student'],
  },
  interviewService: {
    createTemplate: ['recruiter'],
    schedule: ['recruiter', 'campus'],
    startAIInterview: ['student'],
    getInterviewFeedback: ['student'],
    completePractice: ['student'],
  },
  recruiterService: {
    getRecruiterDashboard: ['recruiter'],
    createDrive: ['recruiter'],
    shortlistCandidate: ['recruiter', 'campus'],
    shortlistStudent: ['recruiter', 'campus'],
    getCandidates: ['recruiter', 'campus'],
  },
  campusService: {
    getCampusDashboard: ['campus'],
    getStudents: ['campus'],
    getPlacementAnalytics: ['campus'],
  },
  notificationService: { markRead: ['student', 'recruiter', 'campus'] },
  offerService: { create: ['recruiter'], respond: ['student', 'campus'] },
  documentService: { verify: ['campus'], remove: ['student'] },
  learningService: { complete: ['student'] },
  driveService: {
    getCampuses: ['student', 'campus', 'recruiter'],
    getDriveRequests: ['campus', 'recruiter'],
    getDrive: ['campus', 'recruiter'],
    createDriveRequest: ['recruiter'],
    updateDriveRequest: ['recruiter'],
    transition: ['campus', 'recruiter'],
    proposeSchedule: ['campus'],
    getCampusOpportunities: ['student'],
    updateAttendance: ['campus'],
    updateRound: ['campus', 'recruiter'],
  },
};
const text = z.string().trim().min(1).max(10000),
  id = z.string().min(1).max(100);
const profilePatch = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    course: z.string().max(150).optional(),
    branch: z.string().max(80).optional(),
    year: z
      .string()
      .regex(/^20\d{2}$/)
      .optional(),
    cgpa: z.number().min(0).max(10).optional(),
    activeBacklogs: z.number().int().min(0).max(20).optional(),
    bio: z.string().max(3000).optional(),
    projects: z.array(z.string().max(500)).max(40).optional(),
    projectDescriptions: z.record(z.string().max(3000)).optional(),
    records: z.record(z.array(z.string().max(1000)).max(30)).optional(),
  })
  .strict();
const optionalId = id.optional();
const schemas: Record<string, z.ZodTypeAny> = {
  'studentService.updateStudent': z.tuple([profilePatch]),
  'studentService.updatePhoto': z.tuple([z.string().max(2000000).optional()]),
  'studentService.addSkill': z.tuple([
    z.string().trim().min(1).max(80),
    z.enum(['Beginner', 'Intermediate', 'Advanced']),
  ]),
  'studentService.removeSkill': z.tuple([id]),
  'studentService.editSkillLevel': z.tuple([id, z.enum(['Beginner', 'Intermediate', 'Advanced'])]),
  'applicationService.apply': z.tuple([id]),
  'applicationService.advance': z.tuple([id]),
  'applicationService.reject': z.tuple([id]),
  'matchingService.getMatchExplanation': z.tuple([id]),
  'aiService.getSkillGaps': z.tuple([optionalId]),
  'aiService.parseJobDescription': z.tuple([text]),
  'aiService.predictPlacementRisk': z.tuple([id]),
  'aiService.analyzeResume': z.tuple([id]),
  'notificationService.markRead': z.tuple([optionalId]),
  'learningService.complete': z.tuple([z.string().min(1).max(200)]),
  'contestService.joinContest': z.tuple([id]),
  'contestService.submitContest': z.tuple([id, text]),
  'documentService.verify': z.tuple([id]),
  'documentService.remove': z.tuple([id]),
  'offerService.create': z.tuple([
    z
      .object({
        company: z.string().min(2).max(120),
        role: z.string().min(2).max(150),
        ctc: z.string().min(1).max(60),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        joining: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        kind: z.enum(['Full-time', 'PPO', 'Internship conversion']).optional(),
      })
      .strict(),
  ]),
  'offerService.respond': z.tuple([
    id,
    z.enum(['Accepted', 'Declined', 'Deferred', 'Withdrawn', 'Joined']),
  ]),
  'recruiterService.shortlistStudent': z.tuple([id]),
  'recruiterService.shortlistCandidate': z.tuple([id]),
  'interviewService.createTemplate': z.tuple([
    z.object({
      name: z.string().min(2).max(150),
      targetRole: z.string().max(150),
      difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
      duration: z.number().int().min(5).max(120),
      skills: z.string().max(500),
      topics: z.string().max(500),
      questions: z.array(z.string().min(5).max(1000)).min(3).max(20),
      audience: z.enum(['Applicants', 'Shortlisted candidates', 'All eligible students']),
    }),
  ]),
  'interviewService.schedule': z.tuple([
    z.object({
      company: z.string().min(2).max(120),
      role: z.string().min(2).max(150),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
      mode: z.string().min(2).max(150),
      round: z.string().min(2).max(100),
    }),
  ]),
  'interviewService.startAIInterview': z.tuple([
    optionalId,
    z.string().max(150).optional(),
    z.enum(['Mixed', 'Technical', 'HR', 'Behavioral']).optional(),
    z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
  ]),
  'interviewService.completePractice': z.tuple([
    z.array(z.string().min(20).max(5000)).min(3).max(20),
    z.number().int().min(0).max(7200),
  ]),
  'assessmentService.startAssessment': z.tuple([id]),
  'assessmentService.submitAssessment': z.tuple([
    id,
    z.array(z.number().int().min(-1).max(20)).max(100),
    z.number().int().min(0).max(7200),
  ]),
  'driveService.getDrive': z.tuple([id]),
  'driveService.updateAttendance': z.tuple([id, z.number().int().min(0)]),
  'driveService.updateRound': z.tuple([id, id, z.number().int().min(0)]),
};
export async function dispatch(service: string, method: string, input: unknown[]) {
  const { db, actor, target } = currentContext(),
    key = `${service}.${method}`;
  requireCondition(
    Object.hasOwn(policy, service) && Object.hasOwn(policy[service], method),
    404,
    'Endpoint not found.',
  );
  requireCondition(
    policy[service][method].includes(actor.role),
    403,
    'Your role cannot perform this action.',
  );
  requireCondition(actor.approved, 403, 'Your organization account is waiting for approval.');
  const schema = schemas[key];
  let args = schema ? schema.parse(input) : input;
  // JSON arrays turn undefined optional arguments into null.
  const data = await readWorkspace();
  if (key === 'studentService.getDashboard') {
    const result = await platform.studentService.getDashboard();
    result.pointsSummary = data.pointsSummary;
    return result;
  }
  if (['recruiterService.getCandidates', 'campusService.getStudents'].includes(key))
    return studentProfiles(db, actor);
  if (key === 'contestService.getLeaderboard')
    return (await studentProfiles(db, actor))
      .map((s) => ({ name: s.name, xp: s.xp, campus: s.campus }))
      .sort((a, b) => b.xp - a.xp);
  if (key === 'campusService.getPlacementAnalytics') return analytics(db, actor.campusId);
  if (key === 'aiService.parseJobDescription') return parseRequirements(String(args[0]));
  if (key === 'matchingService.getMatchExplanation') {
    const local = await platform.matchingService.getMatchExplanation(String(args[0]));
    const job = data.drives.find((d) => (d.opportunityId || d.id) === args[0]);
    requireCondition(job, 404, 'Opportunity not found.');
    const remote = await requestMl(
      'jobs',
      {
        studentProfile: {
          skills: data.student.skills.map((s) => redactMlText(s.name)),
          education: [redactMlText(data.student.course)],
          experience: [],
          projects: data.student.projects.map((p) =>
            redactMlText(`${p}: ${data.student.projectDescriptions?.[p] || ''}`).slice(0, 2000),
          ),
        },
        job: {
          title: job.role,
          description: redactMlText(job.description || job.role).slice(0, 10000),
          requiredSkills: job.skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
      },
      jobResponse,
      Boolean(actor.mlConsent),
    );
    return {
      ...local,
      ml: mlIntegration(remote),
      ...(remote.data ? { lexicalMatch: remote.data } : {}),
    };
  }
  if (key === 'aiService.predictPlacementRisk') {
    requireCondition(target && args[0] === target.id, 403, 'Select an authorized student.');
    const r = readiness(data.student, data.history),
      row = {
        cohort: 'inference',
        ...Object.fromEntries(
          r.categories.map((c, i) => [
            ['verifiedSkills', 'academics', 'projects', 'aptitude', 'communication', 'interview'][
              i
            ],
            c.score,
          ]),
        ),
        placed: 0,
      } as OutcomeRow;
    const { cohort: _cohort, placed: _placed, ...evidence } = row;
    const remote = await requestMl(
      'placement',
      { evidence },
      placementResponse,
      Boolean(target.mlConsent),
    );
    return {
      studentId: target.id,
      label: 'Preparation support indicator',
      score: r.score,
      categories: r.categories,
      risk: r.score < 45 ? 'High' : r.score < 70 ? 'Moderate' : 'Low',
      factors: r.factors,
      model: remote.data
        ? {
            available: true,
            label: 'External historical model estimate',
            probability: Math.round(remote.data.outcomeProbability * 100),
            provenance: remote.data.provenance,
            limitations: remote.data.limitations,
          }
        : modelInsight(row),
      ml: mlIntegration(remote),
    };
  }
  if (key === 'aiService.getCareerRecommendations') {
    const roles = ['Frontend Developer', 'Backend Developer', 'Data Analyst', 'Cloud Engineer'];
    const stacks = [
      'React JavaScript HTML CSS',
      'Node.js SQL Express Java',
      'Python SQL Excel PowerBI',
      'AWS Docker Kubernetes',
    ];
    const scores = similarity(data.student.skills.map((s) => s.name).join(' '), stacks);
    return roles
      .map((role, i) => ({ role, score: scores[i] }))
      .sort((a, b) => b.score - a.score)
      .map((r) => r.role);
  }
  if (key === 'aiService.analyzeResume') {
    const doc = data.documents.find((d) => d.id === args[0]) as (typeof data.documents)[number] & {
      storageKey?: string;
      mime?: string;
    };
    requireCondition(doc?.storageKey, 404, 'Upload a PDF resume first.');
    requireCondition(
      doc.mime === 'application/pdf',
      400,
      'Resume analysis currently supports text-based PDF files.',
    );
    const parsed = await pdf(await downloadFile(doc.storageKey));
    requireCondition(
      parsed.text.trim().length > 30,
      422,
      'No readable text was found. Upload a text-based PDF; scanned PDFs need OCR.',
    );
    const local = analyzeResumeText(parsed.text.slice(0, 40000));
    const remote = await requestMl(
      'resume',
      { resumeText: redactMlText(parsed.text.slice(0, 40000)), language: 'en' },
      resumeResponse,
      Boolean(actor.mlConsent),
    );
    const advice = await coaching(
      'Suggest resume improvements without inventing achievements',
      { text: parsed.text.slice(0, 18000) },
      Boolean((actor as typeof actor & { aiConsent?: boolean }).aiConsent),
    ).catch(() => undefined);
    return {
      documentId: doc.id,
      ...local,
      ...(advice ? { label: 'NLP + AI resume coaching', suggestions: advice.suggestions } : {}),
      ...(remote.data
        ? {
            label: 'External resume extraction · review required',
            skills: extractedNames(remote.data.skills),
            suggestions: [
              ...local.suggestions,
              `Extracted skills: ${extractedNames(remote.data.skills).join(', ') || 'None identified'}. Review these before adding them to your profile.`,
              `Education: ${remote.data.education?.length || 0} · Experience: ${remote.data.experience?.length || 0} · Projects: ${remote.data.projects?.length || 0}.`,
            ],
          }
        : {}),
      ml: mlIntegration(remote),
    };
  }
  if (key === 'assessmentService.startAssessment') {
    requireCondition(
      data.assessments.some((a) => a.id === args[0]),
      404,
      'Assessment not found.',
    );
    const result = await platform.assessmentService.startAssessment(String(args[0]));
    result.questions = (await assessmentQuestions(db, String(args[0]))) || result.questions;
    const attemptId = randomUUID();
    await db.put(
      'assessment-session',
      attemptId,
      {
        id: attemptId,
        assessmentId: args[0],
        duration: result.assessment.duration,
        started: Date.now(),
        submitted: false,
        questions: result.questions,
      },
      actor.campusId,
      actor.id,
    );
    return { ...result, attemptId, questions: result.questions.map(({ answer, ...q }) => q) };
  }
  if (key === 'assessmentService.submitAssessment') {
    const active = (
      await db.list<{
        id: string;
        assessmentId: string;
        duration?: number;
        started: number;
        submitted: boolean;
        questions: Question[];
      }>('assessment-session', actor.campusId, actor.id)
    )
      .filter((s) => s.assessmentId === args[0] && !s.submitted)
      .sort((a, b) => b.started - a.started)[0];
    requireCondition(active, 409, 'Start an assessment before submitting it.');
    requireCondition(
      Date.now() - active.started <= Math.min((active.duration || 120) * 60 + 60, 7260) * 1000,
      409,
      'Assessment session expired.',
    );
    requireCondition(
      (args[1] as number[]).length === active.questions.length,
      400,
      'Provide one answer for each question.',
    );
    const assessment = data.assessments.find((a) => a.id === args[0]);
    requireCondition(assessment, 404, 'Assessment is no longer available.');
    requireCondition(
      Date.now() - active.started <= ((active.duration || assessment.duration) * 60 + 60) * 1000,
      409,
      'Assessment time has expired.',
    );
    const answers = args[1] as number[];
    requireCondition(
      answers.every(
        (answer, index) =>
          answer === -1 || (answer >= 0 && answer < active.questions[index].options.length),
      ),
      400,
      'Invalid answer option.',
    );
    const score = Math.round(
      (active.questions.filter((q, i) => q.answer === answers[i]).length /
        active.questions.length) *
        100,
    );
    const previous =
      data.student.skills.find((s) => s.name === assessment.skill)?.verified ||
      data.history.some((h) => h.assessmentId === assessment.id && h.score >= 70 && h.points > 0);
    const points = assessment.skill
      ? score >= 70 && !previous
        ? POINTS.skillVerificationPassed
        : 0
      : POINTS.assessmentCompleted;
    const result = {
      topicScores: Object.fromEntries(
        [...new Set(active.questions.map((q) => q.topic))].map((topic) => {
          const grouped = active.questions
            .map((q, index) => ({ ...q, index }))
            .filter((q) => q.topic === topic);
          return [
            topic,
            Math.round(
              (grouped.filter((q) => q.answer === answers[q.index]).length / grouped.length) * 100,
            ),
          ];
        }),
      ),
      id: randomUUID(),
      assessmentId: assessment.id,
      name: assessment.name,
      type: assessment.type,
      score,
      points,
      date: new Date().toISOString().slice(0, 10),
      seconds: Math.round((Date.now() - active.started) / 1000),
    };
    await mockAdapter.update((d) => {
      d.history.unshift(result);
      d.student.xp += points;
      const skill = d.student.skills.find((s) => s.name === assessment.skill);
      if (skill && score >= 70) skill.verified = true;
    });
    active.submitted = true;
    await db.put('assessment-session', active.id, active, actor.campusId, actor.id);
    return result;
  }
  if (key === 'contestService.joinContest' || key === 'contestService.submitContest') {
    const contest = data.contests.find((c) => c.id === args[0]);
    requireCondition(contest, 404, 'Contest is unavailable.');
    const managed = await db.get<AdminContest>('admin-contest', contest.id);
    if (managed && key === 'contestService.submitContest') {
      requireCondition(contest.joined, 409, 'Join this contest before submitting.');
      requireCondition(
        String(args[1]).trim().toLowerCase() === managed.answer.trim().toLowerCase(),
        400,
        'That answer is incorrect. Try again.',
      );
      return mockAdapter.update((d) => {
        const current = d.contests.find((c) => c.id === contest.id)!;
        if (current.completed) return;
        current.completed = true;
        d.student.xp += managed.points;
        d.history.unshift({
          id: randomUUID(),
          assessmentId: contest.id,
          name: contest.name,
          type: 'Coding',
          score: 100,
          points: managed.points,
          date: new Date().toISOString().slice(0, 10),
          seconds: 0,
        });
      });
    }
  }
  if (key === 'interviewService.startAIInterview') {
    const result = await platform.interviewService.startAIInterview(
      args[0] as string | undefined,
      args[1] as string | undefined,
      args[2] as string | undefined,
      args[3] as string | undefined,
    );
    await db.put(
      'practice',
      actor.id,
      { questions: result.questions, started: Date.now(), completed: false },
      actor.campusId,
      actor.id,
    );
    return { ...result, label: 'Interview preparation' };
  }
  if (key === 'interviewService.completePractice') {
    const practice = await db.get<{ questions: string[]; started: number; completed: boolean }>(
      'practice',
      actor.id,
    );
    requireCondition(practice && !practice.completed, 409, 'Start a new practice session first.');
    const answers = args[0] as string[];
    requireCondition(
      answers.length === practice.questions.length,
      400,
      'Answer all practice questions.',
    );
    const feedback = interviewFeedback(practice.questions, answers);
    const remote = await requestMl(
      'interview',
      {
        responses: practice.questions.map((question, i) => ({
          question: redactMlText(question),
          answer: redactMlText(answers[i]),
        })),
        rubric: [
          { name: 'Structure', expectedTerms: ['situation', 'action', 'result'] },
          {
            name: 'Specific evidence',
            expectedTerms: ['built', 'tested', 'measured', 'implemented'],
          },
        ],
      },
      interviewResponse,
      Boolean(actor.mlConsent),
    );
    const advice = await coaching(
      'Give interview preparation feedback',
      { questions: practice.questions, answers },
      Boolean((actor as typeof actor & { aiConsent?: boolean }).aiConsent),
    ).catch(() => undefined);
    if (advice) {
      feedback.label = 'Text analysis + AI coaching';
      feedback.advice = advice.summary;
    }
    if (remote.data) {
      feedback.label = 'External rubric feedback · preparation only';
      feedback.categories = remote.data.criteria || remote.data.criterionScores || [];
      feedback.advice = Array.isArray(remote.data.generatedPreparationAdvice)
        ? remote.data.generatedPreparationAdvice.join(' ')
        : remote.data.generatedPreparationAdvice;
    }
    const output = { ...feedback, ml: mlIntegration(remote) };
    await db.put('feedback', actor.id, output, actor.campusId, actor.id);
    await mockAdapter.update((d) => {
      d.student.xp += 75;
      d.history.unshift({
        id: randomUUID(),
        assessmentId: 'interview',
        name: 'Interview Practice',
        type: 'Interview',
        score: Math.round(
          feedback.categories.reduce((s, c) => s + c.score, 0) / feedback.categories.length,
        ),
        points: 75,
        date: new Date().toISOString().slice(0, 10),
        seconds: Math.round((Date.now() - practice.started) / 1000),
      });
    });
    practice.completed = true;
    await db.put('practice', actor.id, practice, actor.campusId, actor.id);
    return output;
  }
  if (key === 'interviewService.getInterviewFeedback')
    return (
      (await db.get('feedback', actor.id)) || {
        label: 'No practice feedback yet',
        categories: [],
        advice: 'Complete an interview practice session first.',
      }
    );
  if (key === 'studentService.updateStudent') {
    const patch = args[0] as Partial<Student>;
    // The campus link and verified skills cannot be changed by self-reported profile edits.
    await platform.studentService.updateStudent(patch);
    if (patch.name) {
      actor.name = patch.name;
      await db.put('account', actor.email, actor, actor.campusId, actor.id);
    }
    return readWorkspace();
  }
  if (key === 'studentService.updatePhoto') {
    const photo = args[0] as string | undefined;
    const previous = await db.get<{ key: string }>('photo', actor.id);
    if (photo) {
      requireCondition(
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(photo),
        400,
        'Use a PNG, JPEG, or WebP portrait.',
      );
      const buffer = Buffer.from(photo.split(',')[1], 'base64'),
        mime = detectFile(buffer);
      requireCondition(
        mime && mime.startsWith('image/'),
        400,
        'The portrait is not a valid image file.',
      );
      const key = await uploadFile(actor.id, buffer, mime);
      await db.put('photo', actor.id, { key, mime }, actor.campusId, actor.id);
      await mockAdapter.update((d) => {
        d.student.photo = `/api/v1/photos/${actor.id}?v=${randomUUID()}`;
      });
    } else {
      await db.remove('photo', actor.id);
      await mockAdapter.update((d) => {
        d.student.photo = undefined;
      });
    }
    if (previous) await db.put('storage-gc', randomUUID(), { key: previous.key });
    return readWorkspace();
  }
  if (key === 'offerService.respond')
    requireCondition(
      actor.role === 'campus' ? args[1] === 'Joined' : args[1] !== 'Joined',
      403,
      'Only the campus can record joining; only the student can respond to an offer.',
    );
  if (key === 'offerService.respond' && args[1] === 'Joined')
    requireCondition(
      data.documents.some((d) => d.type === 'Resume' && d.status === 'Verified') &&
        data.documents.every((d) => d.status === 'Verified'),
      409,
      'Verify the resume and pending placement documents before recording joining.',
    );
  if (key === 'recruiterService.shortlistCandidate') {
    const application = data.applications.find((a) => a.id === args[0]);
    const drive = data.drives.find((d) => (d.opportunityId || d.id) === application?.opportunityId);
    requireCondition(
      application &&
        ['Applied', 'Eligibility'].includes(application.stage) &&
        drive &&
        checkEligibility(data.student, drive).passed,
      409,
      'Only eligible pending applications can be shortlisted.',
    );
  }
  if (key === 'offerService.create') {
    requireCondition(
      target && data.applications.some((a) => a.stage === 'Offer'),
      409,
      'Select a candidate whose application has reached the Offer stage.',
    );
    (args[0] as { company: string }).company = actor.organization;
  }
  if (key === 'interviewService.schedule') {
    requireCondition(target, 400, 'Select a student first.');
    if (actor.role === 'recruiter') (args[0] as { company: string }).company = actor.organization;
    const slot = args[0] as { date: string; time: string; company: string };
    const all = await db.list<DemoData>('workspace', target.campusId);
    requireCondition(
      !all.some((w) =>
        w.interviews.some(
          (i) =>
            i.date === slot.date &&
            i.time === slot.time &&
            i.status === 'Scheduled' &&
            i.company === slot.company,
        ),
      ),
      409,
      'This recruiter panel is already booked at that time.',
    );
  }
  if (key === 'recruiterService.shortlistStudent') {
    const allowed = await studentProfiles(db, actor);
    requireCondition(
      allowed.some((s) => s.id === args[0]) && target?.id === args[0],
      403,
      'Select this candidate before shortlisting.',
    );
    const application = data.applications.find((a) => ['Applied', 'Eligibility'].includes(a.stage));
    requireCondition(application, 409, 'No application is available for shortlisting.');
    const drive = data.drives.find((d) => (d.opportunityId || d.id) === application.opportunityId);
    requireCondition(
      drive && checkEligibility(data.student, drive).passed,
      409,
      'This candidate does not meet eligibility.',
    );
    return platform.recruiterService.shortlistCandidate(application.id);
  }
  if (key === 'documentService.remove') {
    const doc = data.documents.find((d) => d.id === args[0]) as (typeof data.documents)[number] & {
      storageKey?: string;
    };
    requireCondition(doc, 404, 'Document not found.');
    if (doc.storageKey) await db.put('storage-gc', randomUUID(), { key: doc.storageKey });
  }
  if (service === 'driveService' || key === 'recruiterService.createDrive') {
    if (['createDriveRequest', 'createDrive'].includes(method)) {
      const submitted = args[0] as Record<string, unknown>;
      const clean = { ...submitted };
      for (const field of [
        'id',
        'status',
        'applicants',
        'schedule',
        'audit',
        'opportunityId',
        'recruiterId',
        'campus',
      ])
        delete clean[field];
      clean.company = actor.organization;
      if (!args[1])
        driveRequestSchema.parse({ ...driveService.getRequestDefaults(clean), ...clean });
      args = [clean, Boolean(args[1])];
    }
    if (method === 'updateDriveRequest') {
      const patch = args[1] as Record<string, unknown>;
      requireCondition(patch && typeof patch === 'object', 400, 'Provide an update.');
      for (const field of [
        'id',
        'status',
        'applicants',
        'schedule',
        'audit',
        'opportunityId',
        'recruiterId',
        'campusId',
        'campus',
      ])
        requireCondition(!Object.hasOwn(patch, field), 400, 'This field cannot be edited.');
      patch.company = actor.organization;
    }
    if (method === 'transition') {
      args = [
        id.parse(args[0]),
        z
          .enum([
            'review',
            'changes',
            'reject',
            'approve',
            'confirm',
            'request-change',
            'finalize',
            'activate',
            'start',
            'complete',
            'cancel',
            'resubmit',
          ])
          .parse(args[1]),
        actor.role,
        z
          .string()
          .max(3000)
          .parse(args[3] || ''),
      ];
    }
  }
  if (service === 'driveService' && method === 'proposeSchedule') {
    const current = data.drives.find((d) => d.id === args[0]) as StoredDrive | undefined,
      slot = args[1] as { date: string; reporting: string; end: string };
    if (current && slot) {
      const all = await db.list<StoredDrive>('drive');
      requireCondition(
        !all.some(
          (d) =>
            d.id !== current.id &&
            d.campusId !== current.campusId &&
            d.recruiterId === current.recruiterId &&
            d.schedule?.date === slot.date &&
            !['CANCELLED', 'REJECTED', 'COMPLETED'].includes(d.status) &&
            d.schedule.reporting < slot.end &&
            slot.reporting < d.schedule.end,
        ),
        409,
        'The recruiter panel is already scheduled at another campus in this time window.',
      );
    }
  }
  const services = { ...platform, driveService } as unknown as Record<
    string,
    Record<string, (...args: unknown[]) => Promise<unknown>>
  >;
  requireCondition(Object.hasOwn(services[service], method), 404, 'Endpoint not found.');
  return services[service][method](...args);
}
export async function analytics(
  db: import('./db').Database,
  campusId: string,
  recruiterId?: string,
) {
  const profiles = await db.list<DemoData>('workspace', recruiterId ? undefined : campusId);
  const drives = (await db.list<StoredDrive>('drive', recruiterId ? undefined : campusId)).filter(
    (d) => !recruiterId || d.recruiterId === recruiterId,
  );
  const ids = new Set(drives.map((d) => d.opportunityId || d.id));
  const students = profiles.filter(
    (p) => !recruiterId || p.applications.some((a) => ids.has(a.opportunityId)),
  );
  const offers = students.flatMap((p) =>
    p.offers.filter(
      (o) => !recruiterId || (o as typeof o & { recruiterId?: string }).recruiterId === recruiterId,
    ),
  );
  const placed = (p: DemoData) =>
    p.offers.some(
      (o) =>
        ['Accepted', 'Joined'].includes(o.status) &&
        (!recruiterId || (o as typeof o & { recruiterId?: string }).recruiterId === recruiterId),
    );
  const breakdown = (values: string[], test: (p: DemoData, name: string) => boolean) =>
    [...new Set(values)].map((name) => {
      const pool = students.filter((p) => test(p, name));
      return {
        name,
        total: pool.length,
        placed: pool.filter(placed).length,
        conversion: Math.round((pool.filter(placed).length / Math.max(1, pool.length)) * 100),
      };
    });
  const packages = offers.map((o) => Number(o.ctc.match(/[\d.]+/)?.[0] || 0)).filter((n) => n > 0);
  return {
    registered: students.length,
    ready: students.filter((p) => readiness(p.student, p.history).score >= 70).length,
    placed: students.filter(placed).length,
    offers: offers.length,
    accepted: offers.filter((o) => ['Accepted', 'Joined'].includes(o.status)).length,
    pending: offers.filter((o) => ['Received', 'Deferred'].includes(o.status)).length,
    joined: offers.filter((o) => o.status === 'Joined').length,
    active: drives.filter((d) => ['ACTIVE', 'IN_PROGRESS'].includes(d.status)).length,
    average: packages.length
      ? Math.round((packages.reduce((s, n) => s + n, 0) / packages.length) * 10) / 10
      : 0,
    highest: Math.max(0, ...packages),
    branches: breakdown(
      students.map(
        (p) => p.student.branch || p.student.course.split('·')[1]?.trim() || 'Unspecified',
      ),
      (p, n) => (p.student.branch || p.student.course.split('·')[1]?.trim() || 'Unspecified') === n,
    ),
    skills: breakdown(
      students.flatMap((p) => p.student.skills.map((s) => s.name)),
      (p, n) => p.student.skills.some((s) => s.name === n),
    ),
    support: students
      .filter((p) => !placed(p) && readiness(p.student, p.history).score < 70)
      .map((p) => ({
        id: p.student.id,
        name: p.student.name,
        score: readiness(p.student, p.history).score,
        factors: readiness(p.student, p.history).factors,
      })),
    recruiters: breakdown(
      drives.map((d) => d.company),
      () => true,
    ).map((row) => ({
      ...row,
      drives: drives.filter((d) => d.company === row.name).length,
      repeatHiring:
        drives.filter((d) => d.company === row.name && d.status === 'COMPLETED').length > 1,
    })),
    documents: {
      total: students.reduce((s, p) => s + p.documents.length, 0),
      verified: students.reduce(
        (s, p) => s + p.documents.filter((d) => d.status === 'Verified').length,
        0,
      ),
    },
  };
}
export async function rankedCandidates(drive: StoredDrive) {
  const { db, actor } = currentContext();
  const profiles = await studentProfiles(db, actor);
  const corpus = profiles.map(
    (s) =>
      `${s.skills.map((s) => s.name).join(' ')} ${s.projects.join(' ')} ${Object.values(s.projectDescriptions || {}).join(' ')}`,
  );
  const semantic = similarity(`${drive.skills} ${drive.description}`, corpus);
  const results = [];
  for (let i = 0; i < profiles.length; i++) {
    const s = profiles[i],
      workspace = await db.get<DemoData>('workspace', s.id),
      rule = fit(s, drive, workspace?.history);
    results.push({
      student: s,
      readiness: readiness(s, workspace?.history),
      ...rule,
      nlpSimilarity: Math.round(semantic[i] * 100),
      hybridScore: rule.eligibility.passed
        ? Math.round(rule.score * 0.85 + semantic[i] * 100 * 0.15)
        : 0,
    });
  }
  return results.sort((a, b) => b.hybridScore - a.hybridScore);
}
