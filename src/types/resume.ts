export interface ResumeAnalysis {
  documentId?: string;
  label: string;
  skills: string[];
  wordCount: number;
  suggestions: string[];
  ml?: { status?: string; message: string };
}
export interface SkillPractice {
  skill: string;
  source: 'openai' | 'gemini' | 'built-in';
  message: string;
  questions: { prompt: string; checkpoints: string[] }[];
}
