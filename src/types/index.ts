export type Role = 'student' | 'recruiter' | 'campus';
export interface User {
  isAdmin?: boolean;
  id: string;
  name: string;
  email: string;
  role: Role;
  approved?: boolean;
  verified?: boolean;
  campusId?: string;
  organization?: string;
  onboardingComplete?: boolean;
}
export interface Skill {
  id: string;
  name: string;
  level: string;
  verified: boolean;
}
export interface Student {
  id: string;
  name: string;
  email: string;
  campus: string;
  course: string;
  year: string;
  cgpa: number;
  branch?: string;
  activeBacklogs?: number;
  bio: string;
  photo?: string;
  skills: Skill[];
  projects: string[];
  projectDescriptions?: Record<string, string>;
  records?: Record<string, string[]>;
  profileCompletion?: number;
  xp: number;
}
export interface Opportunity {
  eligibility?: { passed: boolean; checks: { name: string; passed: boolean; detail: string }[] };
  workMode?: string;
  logo?: string;
  id: string;
  company: string;
  role: string;
  location: string;
  ctc: string;
  skills: string[];
  match: number;
  deadline: string;
  color: string;
  type: string;
  driveId?: string;
  campus?: string;
  visitDate?: string;
  venue?: string;
}
export interface Application {
  currentRoundId?: string;
  resumeId?: string;
  id: string;
  opportunityId: string;
  stage: string;
  date: string;
}
export interface Assessment {
  questionCount?: number;
  id: string;
  name: string;
  type: string;
  duration: number;
  skill?: string;
  color: string;
}
export interface Question {
  prompt: string;
  options: string[];
  answer: number;
  topic: string;
}
export interface AssessmentAttempt {
  activity?: 'contest';
  topicScores?: Record<string, number>;
  id: string;
  assessmentId: string;
  name: string;
  type: string;
  score: number;
  points: number;
  date: string;
  seconds: number;
}
export interface Contest {
  prompt?: string;
  id: string;
  name: string;
  type: string;
  duration: number;
  participants: number;
  points: number;
  difficulty: string;
  joined: boolean;
  completed?: boolean;
}
export interface Interview {
  id: string;
  company: string;
  role: string;
  date: string;
  time: string;
  mode: string;
  round: string;
  status: string;
}
export interface Offer {
  applicationId?: string;
  deadline?: string;
  location?: string;
  letterUrl?: string;
  id: string;
  company: string;
  role: string;
  ctc: string;
  date: string;
  joining: string;
  status: string;
  kind?: 'Full-time' | 'PPO' | 'Internship conversion';
}
export type DriveStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'SCHEDULING'
  | 'AWAITING_RECRUITER_CONFIRMATION'
  | 'CONFIRMED'
  | 'ACTIVE'
  | 'APPLICATIONS_CLOSED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';
export interface Campus {
  id: string;
  name: string;
  location: string;
  studentPool: number;
  courses: string[];
  branches: string[];
}
export interface DriveRound {
  type?: import('./recruitment').RoundType;
  description?: string;
  mode?: 'Online' | 'Offline';
  elimination?: boolean;
  maximumScore?: number;
  passingScore?: number;
  instructions?: string;
  id: string;
  name: string;
  duration: number;
  capacity: number;
  requirements: string;
  cleared: number;
}
export interface DriveSchedule {
  building?: string;
  meetingLink?: string;
  coordinator?: string;
  instructions?: string;
  notes?: string;
  date: string;
  reporting: string;
  talk: string;
  assessment: string;
  interviews: string;
  end: string;
  venue: string;
  lab: string;
  rooms: string;
  systems: number;
}
export interface Drive {
  requestedSlot?: { date: string; start: string; end: string; reason: string };
  eligibilityApprovals?: string[];
  workflowVersion?: number;
  workMode?: 'On-site' | 'Hybrid' | 'Remote';
  responsibilities?: string;
  stipend?: string;
  bond?: string;
  joiningDate?: string;
  requiredDocuments?: string;
  additionalEligibility?: string;
  requireSkills?: boolean;
  companyDetails?: import('./recruitment').CompanyDetails;
  id: string;
  company: string;
  role: string;
  location: string;
  ctc: string;
  vacancies: number;
  description: string;
  cgpa: number;
  skills: string;
  status: DriveStatus;
  applicants: number;
  department?: string;
  workType?: string;
  branches?: string;
  graduationYear?: string;
  backlogRules?: string;
  preferredSkills?: string;
  selectionProcess?: string;
  campusId?: string;
  campus?: string;
  courses?: string;
  allowedBacklogs?: number;
  deadline?: string;
  preferredDates?: string[];
  teamSize?: number;
  hall?: boolean;
  labs?: number;
  rooms?: number;
  systems?: number;
  otherRequirements?: string;
  rounds?: DriveRound[];
  schedule?: DriveSchedule;
  reviewNote?: string;
  audit?: { status: DriveStatus; note: string; date: string }[];
  opportunityId?: string;
  attended?: number;
}
export interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  type: string;
}
export interface DocumentRecord {
  id: string;
  name: string;
  type: string;
  status: string;
  size: string;
}
export interface ReadinessResult {
  score: number;
  label: string;
  categories: { name: string; score: number }[];
}
export interface MatchResult {
  opportunityId: string;
  score: number;
  label: string;
  explanation: { name: string; score: number }[];
}
export interface InterviewTemplate {
  id: string;
  name: string;
  targetRole: string;
  difficulty: string;
  duration: number;
  skills: string;
  topics: string;
  questions: string[];
  audience: string;
}
export interface WorkspaceData {
  instituteStudentUpdates?: Record<string, import('@/utils/student-records').InstituteStudentPatch>;
  communicationPractice?: import('@/utils/communication').CommunicationFeedback[];
  placementVersion?: number;
  campuses?: Campus[];
  student: Student;
  opportunities: Opportunity[];
  applications: Application[];
  assessments: Assessment[];
  history: AssessmentAttempt[];
  contests: Contest[];
  interviews: Interview[];
  offers: Offer[];
  drives: Drive[];
  notifications: Notification[];
  documents: DocumentRecord[];
  learning: string[];
  onboardingDismissed: boolean;
  shortlisted?: string[];
  conflictResolved?: boolean;
  interviewTemplates?: InterviewTemplate[];
  pointsSummary?: { assessments: number; participation: number };
}
