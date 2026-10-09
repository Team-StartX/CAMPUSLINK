import { rpc } from './api/remote';
import type {
  RecruitmentOverview,
  RecruitmentAssignment,
  CampusAssessment,
  Relationship,
  CandidateResult,
  InterviewSlot,
  ApplicantRanking,
} from '@/types/recruitment';
export const recruitmentService = {
  dashboard: () =>
    rpc<{
      metrics: Record<string, number>;
      applicantRankings: ApplicantRanking[];
      matching: {
        driveId: string;
        role: string;
        company: string;
        total: number;
        eligible: number;
        needsPreparation: number;
        skillGaps: { name: string; students: number }[];
      }[];
      applications: {
        id: string;
        name: string;
        stage: string;
        driveId: string;
        company: string;
        role: string;
      }[];
      offers: { id: string; name: string; company: string; role: string; status: string }[];
      results: { name: string; company: string; round: string; status: string }[];
    }>('recruitmentService', 'dashboard'),
  requestSlot: (
    driveId: string,
    input: { date: string; start: string; end: string; reason: string },
  ) => rpc('recruitmentService', 'requestSlot', [driveId, input]),
  verifyEligibility: (driveId: string, studentId: string, approved: boolean, reason: string) =>
    rpc('recruitmentService', 'verifyEligibility', [driveId, studentId, approved, reason]),
  relationships: () => rpc<Relationship[]>('recruitmentService', 'relationships'),
  requestCampus: (campusId: string) =>
    rpc<Relationship>('recruitmentService', 'requestCampus', [campusId]),
  reviewCampus: (id: string, status: string, reason: string) =>
    rpc('recruitmentService', 'reviewCampus', [id, status, reason]),
  overview: (driveId: string) =>
    rpc<RecruitmentOverview>('recruitmentService', 'overview', [driveId]),
  interest: (id: string, value: string) => rpc('recruitmentService', 'interest', [id, value]),
  apply: (id: string, agree: boolean, resumeId?: string) =>
    rpc('recruitmentService', 'apply', [id, agree, resumeId]),
  saveAssignment: (id: string, input: Omit<RecruitmentAssignment, 'id' | 'driveId'>) =>
    rpc('recruitmentService', 'saveAssignment', [id, input]),
  submitAssignment: (id: string, assignmentId: string, content: string, documentId?: string) =>
    rpc('recruitmentService', 'submitAssignment', [id, assignmentId, content, documentId]),
  saveResults: (
    id: string,
    roundId: string,
    rows: Pick<
      CandidateResult,
      'applicationId' | 'status' | 'score' | 'feedback' | 'strengths' | 'gaps' | 'nextSteps'
    >[],
  ) => rpc('recruitmentService', 'saveResults', [id, roundId, rows]),
  publishResults: (id: string, roundId: string) =>
    rpc('recruitmentService', 'publishResults', [id, roundId]),
  scheduleInterview: (
    id: string,
    input: Omit<InterviewSlot, 'id' | 'driveId' | 'studentId'> &
      ({ audience: 'round' } | { studentId: string }) & { override?: boolean; reason?: string },
  ) => rpc('recruitmentService', 'scheduleInterview', [id, input]),
  assessments: () => rpc<CampusAssessment[]>('recruitmentService', 'assessments'),
  startAssessment: (id: string) =>
    rpc<{ expiresAt: string }>('recruitmentService', 'startAssessment', [id]),
  createAssessment: (input: Omit<CampusAssessment, 'id' | 'campusId'>) =>
    rpc('recruitmentService', 'createAssessment', [input]),
  submitAssessment: (id: string, answers: number[]) =>
    rpc<{ score?: number; passed?: boolean; message?: string }>(
      'recruitmentService',
      'submitAssessment',
      [id, answers],
    ),
};
