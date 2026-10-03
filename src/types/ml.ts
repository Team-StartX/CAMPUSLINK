export interface MlAnnotation {
  ml?: { status: string; message: string };
  lexicalMatch?: {
    relevanceScore: number;
    matchedSkills: string[];
    skillGaps: string[];
    method: string;
    trained: false;
  };
}
