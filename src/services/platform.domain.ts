import { DomainError } from '@/utils/domain-error';
import { mockAdapter } from '@/mocks/adapter';
import { POINTS } from '@/config/points.config';
import { Drive, Interview, Student, InterviewTemplate } from '@/types';
import { driveService } from './drive.domain';
import { checkEligibility, driveOpportunity, studentVisible } from '@/utils/placement';
import { readiness, fit } from '@/utils/scoring';
import { contestAchievements, recordContestCompletion } from '@/utils/contest-achievements';
import { instituteStudentPatchSchema, type InstituteStudentPatch } from '@/utils/student-records';
export const studentService = {
  updatePhoto: async (photo?: string) => {
    if (
      photo &&
      (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(photo) ||
        photo.length > 2000000)
    )
      throw new DomainError('Use a PNG, JPG, or WebP photo under 2 MB after resizing.');
    return mockAdapter.update((d) => {
      d.student.photo = photo;
    });
  },
  getDashboard: async () => {
    const d = await mockAdapter.read();
    const s = d.student;
    s.profileCompletion = Math.min(
      100,
      [s.name, s.email, s.campus, s.course, s.year].filter(Boolean).length * 10 +
        (s.cgpa > 0 ? 4 : 0) +
        (s.skills.length ? 8 : 0) +
        (s.projects.length ? 10 : 0) +
        (d.documents.some((doc) => doc.type === 'Resume') ? 10 : 0) +
        ['Experience', 'Certifications', 'Professional links'].filter((c) => s.records?.[c]?.length)
          .length *
          6,
    );
    d.pointsSummary = {
      assessments:
        1400 +
        d.history
          .filter(
            (h) =>
              h.id !== 'attempt-1' &&
              h.id !== 'attempt-2' &&
              h.type !== 'Interview' &&
              h.activity !== 'contest' &&
              !['daily', 'weekly', 'monthly'].includes(h.assessmentId),
          )
          .reduce((sum, h) => sum + h.points, 0),
      participation:
        1080 +
        d.history
          .filter(
            (h) =>
              h.type === 'Interview' ||
              h.activity === 'contest' ||
              ['daily', 'weekly', 'monthly'].includes(h.assessmentId),
          )
          .reduce((sum, h) => sum + h.points, 0),
    };
    d.opportunities = d.drives
      .filter((drive) => studentVisible(drive) && checkEligibility(s, drive).passed)
      .map((drive) => ({
        ...driveOpportunity(
          drive,
          d.opportunities.find((o) => o.id === drive.opportunityId),
        ),
        match: fit(s, drive, d.history).score,
      }))
      .sort((a, b) => b.match - a.match);
    return d;
  },
  updateStudent: (patch: Partial<Student>) =>
    mockAdapter.update((d) => {
      d.student = { ...d.student, ...patch };
    }),
  addSkill: (name: string, level: string) =>
    mockAdapter.update((d) => {
      if (d.student.skills.some((s) => s.name.toLowerCase() === name.toLowerCase()))
        throw new DomainError('This skill is already on your profile.');
      const id = crypto.randomUUID();
      d.student.skills.push({ id, name, level, verified: false });
      d.assessments.push({
        id: `skill-${id}`,
        name: `${name} Skill Verification`,
        type: 'Skill',
        duration: 10,
        skill: name,
        color: 'lavender',
      });
    }),
  removeSkill: (id: string) =>
    mockAdapter.update((d) => {
      d.student.skills = d.student.skills.filter((s) => s.id !== id);
    }),
  editSkillLevel: (id: string, level: string) =>
    mockAdapter.update((d) => {
      if (!['Beginner', 'Intermediate', 'Advanced'].includes(level))
        throw new DomainError('Choose a supported experience level.');
      const skill = d.student.skills.find((s) => s.id === id);
      if (skill) skill.level = level;
    }),
  dismissOnboarding: () =>
    mockAdapter.update((d) => {
      d.onboardingDismissed = true;
    }),
};
export const matchingService = {
  getRecommendedJobs: driveService.getCampusOpportunities,
  getMatchExplanation: async (id: string) => {
    const data = await mockAdapter.read();
    const drive = data.drives.find((d) => (d.opportunityId || d.id) === id);
    if (!drive || !studentVisible(drive) || !checkEligibility(data.student, drive).passed)
      throw new DomainError('Matching is available only for eligible, active campus drives.');
    return {
      opportunityId: id,
      ...fit(data.student, drive, data.history),
    };
  },
};
export const applicationService = {
  advance: (id: string) =>
    mockAdapter.update((d) => {
      const a = d.applications.find((a) => a.id === id);
      const stages = ['Applied', 'Eligibility', 'Shortlisted', 'Assessment', 'Interview', 'Offer'];
      if (!a || !stages.includes(a.stage) || a.stage === 'Offer')
        throw new DomainError('This application cannot advance.');
      a.stage = stages[stages.indexOf(a.stage) + 1];
      d.notifications.unshift({
        id: crypto.randomUUID(),
        title: `Application moved to ${a.stage}`,
        body: 'Check My applications for the updated selection stage.',
        read: false,
        type: 'Application',
      });
    }),
  reject: (id: string) =>
    mockAdapter.update((d) => {
      const a = d.applications.find((a) => a.id === id);
      if (a && a.stage !== 'Offer') a.stage = 'Rejected';
    }),
  apply: (id: string) =>
    mockAdapter.update((d) => {
      const drive = d.drives.find((drive) => (drive.opportunityId || drive.id) === id);
      if (!drive || !studentVisible(drive))
        throw new DomainError('This campus drive is not open for applications.');
      if (!checkEligibility(d.student, drive).passed)
        throw new DomainError(
          'Your profile does not meet this campus drive’s eligibility criteria.',
        );
      if (drive.deadline && drive.deadline < new Date().toISOString().slice(0, 10))
        throw new DomainError('The application deadline has passed.');
      if (d.applications.some((a) => a.opportunityId === id))
        throw new DomainError('You have already applied.');
      d.applications.push({
        id: crypto.randomUUID(),
        opportunityId: id,
        stage: 'Applied',
        date: new Date().toISOString().slice(0, 10),
      });
      drive.applicants += 1;
      d.notifications.unshift({
        id: crypto.randomUUID(),
        title: 'A new possibility is in motion.',
        body: 'Your application has been submitted. Follow its journey in My applications.',
        read: false,
        type: 'Application',
      });
    }),
};
export const assessmentService = {
  getAssessments: async () => (await mockAdapter.read()).assessments,
  startAssessment: async (id: string) => {
    const a = (await mockAdapter.read()).assessments.find((a) => a.id === id);
    if (!a) throw new DomainError('Assessment not found');
    return { assessment: a, questions: mockAdapter.questions(a.skill) };
  },
  submitAssessment: async (id: string, answers: number[], seconds: number) => {
    const { assessment, questions } = await assessmentService.startAssessment(id);
    const score = Math.round(
      (questions.filter((q, i) => q.answer === answers[i]).length / questions.length) * 100,
    );
    const passed = score >= 70;
    const data = await mockAdapter.update((d) => {
      const points = assessment.skill
        ? passed
          ? POINTS.skillVerificationPassed
          : 0
        : POINTS.assessmentCompleted;
      d.history.unshift({
        id: crypto.randomUUID(),
        assessmentId: id,
        name: assessment.name,
        type: assessment.type,
        score,
        points,
        date: new Date().toISOString().slice(0, 10),
        seconds,
      });
      d.student.xp += points;
      if (passed && assessment.skill) {
        const s = d.student.skills.find((s) => s.name === assessment.skill);
        if (s) s.verified = true;
      }
    });
    return data.history[0];
  },
  getAssessmentHistory: async () => (await mockAdapter.read()).history,
};
export const contestService = {
  getContests: async () => (await mockAdapter.read()).contests,
  joinContest: (id: string) =>
    mockAdapter.update((d) => {
      const c = d.contests.find((c) => c.id === id);
      if (c) c.joined = true;
    }),
  submitContest: (id: string, answer: string) =>
    mockAdapter.update((d) => {
      const c = d.contests.find((c) => c.id === id);
      if (!c) throw new DomainError('Contest not found.');
      if (!c.joined) throw new DomainError('Register for this contest first.');
      if (answer.trim() !== '32')
        throw new DomainError('Not quite. Each number doubles. Try again.');
      recordContestCompletion(d, c, c.points, 900);
    }),
  getLeaderboard: async () =>
    [
      { name: 'Sonalika Nayak', xp: 3240, campus: 'DTU' },
      { name: 'Sachin Dash', xp: 2980, campus: 'IIT Delhi' },
      {
        name: (await mockAdapter.read()).student.name,
        xp: (await mockAdapter.read()).student.xp,
        campus: 'DTU',
      },
      { name: 'Rishikanta Sahoo', xp: 2160, campus: 'DTU' },
      { name: 'Ayushman Nayak', xp: 2780, campus: 'DTU' },
      { name: 'Biswojit Sahoo', xp: 2890, campus: 'DTU' },
    ].sort((a, b) => b.xp - a.xp),
};
export const aiService = {
  getReadinessScore: async () => {
    const d = await mockAdapter.read();
    return readiness(d.student, d.history);
  },
  getSkillGaps: async (driveId?: string) => {
    const d = await mockAdapter.read();
    const drive =
      d.drives.find((r) => r.id === driveId) ||
      d.drives.find((r) => studentVisible(r) && checkEligibility(d.student, r).passed);
    return drive ? fit(d.student, drive, d.history).gaps : [];
  },
  parseJobDescription: async (text: string) => ({
    label: 'Demo extraction',
    skills: ['React', 'JavaScript', 'SQL'].filter((s) =>
      text.toLowerCase().includes(s.toLowerCase()),
    ),
    eligibility: 'Review extracted requirements before publishing.',
  }),
  predictPlacementRisk: async (studentId: string) => {
    const d = await mockAdapter.read();
    const r = readiness(d.student, d.history);
    return {
      studentId,
      label: 'Rule-based support indicator',
      score: r.score,
      categories: r.categories,
      risk: r.score < 45 ? 'High' : r.score < 70 ? 'Moderate' : 'Low',
      factors: r.factors,
    };
  },
  analyzeResume: async (documentId: string) => ({
    documentId,
    label: 'Demo resume analysis' as const,
    suggestions: [
      'Add measurable project outcomes.',
      'Keep contact information and links current.',
    ],
  }),
  getCareerRecommendations: async () => ['Frontend Developer', 'Backend Developer', 'Data Analyst'],
};
export const interviewService = {
  getCommunicationHistory: async () => (await mockAdapter.read()).communicationPractice || [],
  analyzeCommunication: async (input: import('@/utils/communication').CommunicationInput) => {
    const { communicationInputSchema, analyzeCommunication } =
      await import('@/utils/communication');
    const feedback = {
      ...analyzeCommunication(communicationInputSchema.parse(input)),
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
    };
    await mockAdapter.update((data) => {
      data.communicationPractice = [feedback, ...(data.communicationPractice || [])].slice(0, 15);
    });
    return feedback;
  },
  createTemplate: (template: Omit<InterviewTemplate, 'id'>) =>
    mockAdapter.update((d) => {
      d.interviewTemplates = [
        ...(d.interviewTemplates || []),
        { ...template, id: crypto.randomUUID() },
      ];
    }),
  schedule: (interview: Omit<Interview, 'id' | 'status'>) =>
    mockAdapter.update((d) => {
      if (d.interviews.some((i) => i.date === interview.date && i.time === interview.time))
        throw new DomainError('Schedule conflict. Please choose another time.');
      d.interviews.push({ ...interview, id: crypto.randomUUID(), status: 'Scheduled' });
      d.notifications.unshift({
        id: crypto.randomUUID(),
        title: `Interview scheduled · ${interview.company}`,
        body: `${interview.date} at ${interview.time} · ${interview.mode}`,
        read: false,
        type: 'Interview',
      });
    }),
  startAIInterview: async (
    templateId?: string,
    role = 'Frontend Developer',
    type = 'Mixed',
    difficulty = 'Intermediate',
  ) => {
    const t = (await mockAdapter.read()).interviewTemplates?.find((t) => t.id === templateId);
    return {
      label: 'Demo Interview',
      questions:
        t?.questions ||
        (type === 'HR' || type === 'Behavioral'
          ? [
              'Tell me about a time you handled a disagreement in a team.',
              `Why are you interested in a ${role} role?`,
              'Describe how you prioritize when several deadlines overlap.',
            ]
          : [
              `Tell me about yourself and a project relevant to a ${role} role.`,
              role === 'Backend Developer'
                ? 'How would you design a reliable REST API and manage database access?'
                : role === 'Data Analyst'
                  ? 'How would you clean a dataset and check whether your conclusions are reliable?'
                  : `How would you manage state in a growing React application? Explain at ${difficulty.toLowerCase()} level.`,
              'Describe a difficult problem you solved with your team.',
            ]),
    };
  },
  getInterviewFeedback: async () => ({
    label: 'Demo feedback',
    categories: [
      { name: 'Communication', score: 78 },
      { name: 'Technical relevance', score: 82 },
      { name: 'Clarity', score: 80 },
      { name: 'Structure', score: 74 },
    ],
    advice: 'Use a specific example and explain the measurable impact of your work.',
  }),
  completePractice: (_answers?: string[], _seconds?: number) =>
    mockAdapter.update((d) => {
      d.student.xp += POINTS.mockInterviewCompleted;
      d.history.unshift({
        id: crypto.randomUUID(),
        assessmentId: 'interview',
        name: 'Mock Interview Practice',
        type: 'Interview',
        score: 78,
        points: POINTS.mockInterviewCompleted,
        date: new Date().toISOString().slice(0, 10),
        seconds: 600,
      });
    }),
};
export const recruiterService = {
  getRecruiterDashboard: () => mockAdapter.read(),
  createDrive: (drive: Omit<Drive, 'id' | 'applicants'>) => driveService.createDriveRequest(drive),
  shortlistCandidate: (id: string) =>
    mockAdapter.update((d) => {
      const a = d.applications.find((a) => a.id === id);
      if (a) a.stage = 'Shortlisted';
    }),
  shortlistStudent: (id: string) =>
    mockAdapter.update((d) => {
      d.shortlisted = Array.from(new Set([...(d.shortlisted || []), id]));
    }),
  getCandidates: async () => {
    const data = await mockAdapter.read(),
      s = data.student;
    const profiles = [
      s,
      {
        ...s,
        photo: undefined,
        email: 'sonalika@campus.edu',
        id: 'STU-20483',
        name: 'Sonalika Nayak',
        cgpa: 9.1,
        xp: 3240,
      },
      {
        ...s,
        photo: undefined,
        email: 'sachin@campus.edu',
        id: 'STU-20484',
        name: 'Sachin Dash',
        cgpa: 8.8,
        xp: 2980,
      },
      {
        ...s,
        photo: undefined,
        email: 'rishikanta@campus.edu',
        id: 'STU-20485',
        name: 'Rishikanta Sahoo',
        cgpa: 8.2,
        xp: 2160,
      },
      {
        ...s,
        photo: undefined,
        email: 'ayushman@campus.edu',
        id: 'STU-20486',
        name: 'Ayushman Nayak',
        cgpa: 8.6,
        xp: 2780,
      },
      {
        ...s,
        photo: undefined,
        email: 'biswojit@campus.edu',
        id: 'STU-20487',
        name: 'Biswojit Sahoo',
        cgpa: 8.9,
        xp: 2890,
      },
    ];
    return profiles.map((student) => ({
      ...student,
      ...data.instituteStudentUpdates?.[student.id],
    }));
  },
};
export const campusService = {
  getCampusDashboard: () => mockAdapter.read(),
  getStudents: recruiterService.getCandidates,
  updateStudent: async (studentId: string, input: InstituteStudentPatch) => {
    const patch = instituteStudentPatchSchema.parse(input);
    const person = (await campusService.getStudents()).find((s) => s.id === studentId);
    if (!person) throw new DomainError('Student is unavailable for your institute.');
    const data = await mockAdapter.update((d) => {
      if (d.student.id === studentId) Object.assign(d.student, patch);
      else {
        d.instituteStudentUpdates ||= {};
        d.instituteStudentUpdates[studentId] = {
          ...d.instituteStudentUpdates[studentId],
          ...patch,
        };
      }
    });
    return studentId === data.student.id ? data.student : { ...person, ...patch };
  },
  getStudentAchievements: async (studentId: string) => {
    if (!(await campusService.getStudents()).some((s) => s.id === studentId))
      throw new DomainError('Student is unavailable for your institute.');
    const data = await mockAdapter.read();
    return contestAchievements(
      studentId === data.student.id ? data : { contests: [], history: [] },
    );
  },
  getPlacementAnalytics: async () => [
    { name: 'CSE', ready: 88, placed: 72 },
    { name: 'IT', ready: 82, placed: 64 },
    { name: 'ECE', ready: 74, placed: 58 },
    { name: 'EE', ready: 68, placed: 46 },
    { name: 'ME', ready: 62, placed: 40 },
  ],
};
export const notificationService = {
  markRead: (id?: string) =>
    mockAdapter.update((d) =>
      d.notifications.forEach((n) => {
        if (!id || n.id === id) n.read = true;
      }),
    ),
};
export const offerService = {
  create: (offer: Omit<import('@/types').Offer, 'id' | 'status'>) =>
    mockAdapter.update((d) => {
      d.offers.push({ ...offer, id: crypto.randomUUID(), status: 'Received' });
      d.notifications.unshift({
        id: crypto.randomUUID(),
        title: `A new chapter with ${offer.company}.`,
        body: `You received an offer for ${offer.role}. Review it in My offers.`,
        type: 'Offer',
        read: false,
      });
      if (d.documents.some((doc) => doc.status !== 'Verified'))
        d.notifications.unshift({
          id: crypto.randomUUID(),
          title: 'Prepare your placement documents',
          body: 'An offer is ready. Review pending documents and verification before joining.',
          type: 'Document',
          read: false,
        });
    }),
  respond: (id: string, status: string) =>
    mockAdapter.update((d) => {
      const o = d.offers.find((o) => o.id === id);
      if (!o) throw new DomainError('Offer not found.');
      const transitions: Record<string, string[]> = {
        Received: ['Accepted', 'Declined', 'Deferred'],
        Deferred: ['Accepted', 'Declined', 'Withdrawn'],
        Accepted: ['Joined', 'Withdrawn'],
      };
      if (!transitions[o.status]?.includes(status))
        throw new DomainError('This offer response is unavailable at the current stage.');
      o.status = status;
      d.notifications.unshift({
        id: crypto.randomUUID(),
        title: `${o.company} offer · ${status}`,
        body:
          status === 'Joined'
            ? 'Joining has been recorded by the placement team.'
            : 'Your offer response has been recorded.',
        read: false,
        type: 'Offer',
      });
    }),
};
export const documentService = {
  verify: (id: string) =>
    mockAdapter.update((d) => {
      const document = d.documents.find((doc) => doc.id === id);
      if (document) document.status = 'Verified';
    }),
  upload: (file: File, type: string) =>
    mockAdapter.update((d) => {
      if (file.size > 10 * 1024 * 1024) throw new DomainError('Maximum file size is 10 MB.');
      d.documents.push({
        id: crypto.randomUUID(),
        name: file.name,
        type,
        status: 'Uploaded',
        size: `${Math.ceil(file.size / 1024)} KB`,
      });
    }),
  remove: (id: string) =>
    mockAdapter.update((d) => {
      d.documents = d.documents.filter((doc) => doc.id !== id);
    }),
};
export const learningService = {
  complete: (step: string) =>
    mockAdapter.update((d) => {
      if (!d.learning.includes(step)) d.learning.push(step);
    }),
};
export const demoService = {
  reset: () => mockAdapter.reset(),
  resolveConflict: () =>
    mockAdapter.update((d) => {
      d.conflictResolved = true;
    }),
};
// Adapter boundary: replace mockAdapter methods with /api/v1 requests when the backend is ready.
