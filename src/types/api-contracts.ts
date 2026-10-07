export interface Education {
  id: string;
  studentId: string;
  institution: string;
  course: string;
  branch: string;
  startYear: number;
  graduationYear: number;
  cgpa: number;
}
export interface Project {
  id: string;
  studentId: string;
  title: string;
  description: string;
  skills: string[];
  url?: string;
}
export interface Certification {
  id: string;
  studentId: string;
  title: string;
  issuer: string;
  issuedAt: string;
  credentialUrl?: string;
}
export interface Recruiter {
  id: string;
  userId: string;
  companyId: string;
  designation: string;
}
export interface Campus {
  id: string;
  name: string;
  code: string;
  coordinatorId: string;
}
export interface CareerPoints {
  studentId: string;
  total: number;
  skillVerification: number;
  assessments: number;
  contests: number;
  interviewPractice: number;
}
export interface SkillGapResult {
  studentId: string;
  label: 'Skill gaps';
  gaps: { skill: string; currentLevel: number; targetLevel: number; recommendation: string }[];
}
export interface AIInterviewResult {
  interviewId: string;
  label: 'Practice feedback';
  scores: { category: string; score: number }[];
  feedback: string[];
}
export interface PlacementRiskResult {
  studentId: string;
  label: 'Preparation support';
  risk: 'Low' | 'Moderate' | 'High';
  factors: string[];
}
export interface ResumeAnalysisResult {
  documentId: string;
  label: 'Resume analysis';
  suggestions: string[];
}
export interface APIResponse<T> {
  data: T;
  requestId: string;
}
export interface APIError {
  message: string;
  code: string;
  fieldErrors?: Record<string, string[]>;
}
