import { initialData, reactQuestions, generalQuestions } from './data';
import { WorkspaceData } from '@/types';
import { getSkillQuestions } from './question-banks';
import { migratePlacement } from './placement';
let memory: WorkspaceData | undefined;
type Persistence = {
  read: () => Promise<WorkspaceData>;
  update: (action: (data: WorkspaceData) => void) => Promise<WorkspaceData>;
};
let persistence: Persistence | undefined;
export function configurePersistence(provider: Persistence) {
  persistence = provider;
}
export const mockAdapter = {
  async read(): Promise<WorkspaceData> {
    if (persistence) return persistence.read();
    if (process.env.NODE_ENV !== 'test')
      throw new Error('Authenticated workspace persistence is not configured.');
    if (!memory) memory = structuredClone(initialData);
    migratePlacement(memory);
    for (const skill of memory.student.skills) {
      if (!memory.assessments.some((a) => a.skill === skill.name))
        memory.assessments.push({
          id: `skill-${skill.id}`,
          name: `${skill.name} Skill Verification`,
          type: 'Skill',
          duration: 10,
          skill: skill.name,
          color: 'lavender',
        });
    }
    return structuredClone(memory);
  },
  async update(action: (data: WorkspaceData) => void) {
    if (persistence) return persistence.update(action);
    const data = await this.read();
    action(data);
    memory = data;
    return structuredClone(data);
  },
  questions(skill?: string) {
    return structuredClone(
      skill === 'React' ? reactQuestions : getSkillQuestions(skill) || generalQuestions,
    );
  },
  reset() {
    if (process.env.NODE_ENV !== 'test')
      throw new Error('Sample workspaces are restricted to isolated tests.');
    memory = structuredClone(initialData);
  },
};
