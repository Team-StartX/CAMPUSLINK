export const roundTypes = [
  'Resume Screening',
  'Aptitude Test',
  'Coding Test',
  'Technical Test',
  'Assignment',
  'Group Discussion',
  'Technical Interview',
  'Managerial Interview',
  'HR Interview',
  'Document Verification',
  'Custom Round',
] as const;
export type RoundType = (typeof roundTypes)[number];
export interface CompanyDetails {
  website: string;
  industry: string;
  description: string;
  headquarters: string;
  size: string;
  logo: string;
}
export interface Relationship {
  id: string;
  campusId: string;
  recruiterId: string;
  company: string;
  status: 'Pending' | 'Accepted' | 'Rejected';
  reason: string;
}
export interface CandidateResult {
  id: string;
  driveId: string;
  applicationId: string;
  studentId: string;
  roundId: string;
  status: 'Pending' | 'Qualified' | 'Rejected' | 'Absent' | 'Under Review';
  score?: number;
  feedback: string;
  strengths?: string;
  gaps?: string;
  nextSteps?: string;
  publishedAt?: string;
  published: boolean;
}
export interface StudentInterviewFeedback extends CandidateResult {
  company: string;
  role: string;
  round: string;
  risk: 'Low' | 'Moderate' | 'High' | 'Not assessed';
}
export interface ApplicantRanking {
  applicationId: string;
  studentId: string;
  name: string;
  driveId: string;
  company: string;
  role: string;
  stage: string;
  rank: number;
  skillMatch: number;
  matchedSkills: string[];
  missingSkills: string[];
}
export interface RecruitmentAssignment {
  id: string;
  driveId: string;
  roundId: string;
  title: string;
  description: string;
  tasks: string;
  instructions: string;
  format: string;
  link: string;
  maximumMarks: number;
  deadline: string;
  allowedTypes: string;
  criteria: string;
}
export interface AssignmentSubmission {
  documentId?: string;
  documentName?: string;
  id: string;
  assignmentId: string;
  studentId: string;
  applicationId: string;
  content: string;
  submittedAt: string;
}
export interface Candidate {
  studentId: string;
  name: string;
  applicationId: string;
  stage: string;
  currentRoundId?: string;
}
export interface InterviewSlot {
  id: string;
  driveId: string;
  roundId: string;
  studentId: string;
  date: string;
  time: string;
  duration: number;
  venue: string;
  room: string;
  panel: string;
  mode: string;
  meetingLink: string;
  audience?: 'round';
}
export interface RecruitmentOverview {
  eligibleCandidates?: { studentId: string; name: string; branch: string }[];
  eligibilityReviews?: { studentId: string; name: string; approved: boolean }[];
  candidates: Candidate[];
  results: CandidateResult[];
  assignments: RecruitmentAssignment[];
  submissions: AssignmentSubmission[];
  slots: InterviewSlot[];
  counts: {
    total: number;
    eligible: number;
    interested: number;
    applicants: number;
    shortlisted: number;
    selected: number;
  };
  interest?: string;
}
export interface CampusAssessment {
  attempts?: { studentId: string; name: string; score?: number; date: string }[];
  id: string;
  campusId: string;
  title: string;
  description: string;
  type: string;
  questions: { prompt: string; options: string[]; answer?: number }[];
  duration: number;
  start: string;
  end: string;
  maximumMarks: number;
  passingMarks: number;
  batch: string;
  branch: string;
  studentIds: string[];
  instructions: string;
  visibleResults: boolean;
}
