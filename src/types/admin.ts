import type { Assessment, Campus, Contest, Question, User } from './index';
export type PublishStatus = 'draft' | 'published' | 'archived';
export interface AdminQuestion extends Question {
  id: string;
  updatedAt: string;
}
export interface AdminAssessment extends Assessment {
  status: PublishStatus;
  questionIds: string[];
  campusId: string;
  updatedAt: string;
}
export interface AdminContest extends Contest {
  status: PublishStatus;
  prompt: string;
  answer: string;
  campusId: string;
  updatedAt: string;
}
export interface AuditEntry {
  event: string;
  actorId?: string;
  targetId?: string;
  time: string;
  approved?: boolean;
}
export interface AdminData {
  accounts: User[];
  questions: AdminQuestion[];
  assessments: AdminAssessment[];
  contests: AdminContest[];
  campuses: Campus[];
  audit: AuditEntry[];
  integrations: { database: string; storage: string; email: string; ai: string };
}
