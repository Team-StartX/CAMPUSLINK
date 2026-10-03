import { initialData, reactQuestions, generalQuestions } from './data';
import { DemoData } from '@/types';
import { getSkillQuestions } from './question-banks';
import { migratePlacement } from './placement';
let memory: DemoData | undefined;
type Persistence = { read: () => Promise<DemoData>; update: (action: (data: DemoData) => void) => Promise<DemoData> };
let persistence: Persistence | undefined;
export function configurePersistence(provider: Persistence) { persistence = provider; }
export const mockAdapter = {
  async read(): Promise<DemoData> {
    if (persistence) return persistence.read();
    if (!memory) {
      try {
        const saved = typeof window !== 'undefined' && localStorage.getItem('campuslink-data');
        memory = saved ? (JSON.parse(saved) as DemoData) : structuredClone(initialData);
      } catch {
        memory = structuredClone(initialData);
      }
    }
    if (
      (memory.student.name === 'Aarav Sharma' && memory.student.email === 'aarav@campus.edu') ||
      (memory.student.name === 'Biswojit Sahoo' && memory.student.email === 'biswojit@campus.edu')
    ) {
      memory.student.name = 'Diptiprav Dash';
      memory.student.email = 'diptiprav@campus.edu';
    }
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
  async update(action: (data: DemoData) => void) {
    if (persistence) return persistence.update(action);
    const data = await this.read();
    action(data);
    if (typeof window !== 'undefined')
      localStorage.setItem('campuslink-data', JSON.stringify(data));
    memory = data;
    return structuredClone(data);
  },
  questions(skill?: string) {
    return structuredClone(
      skill === 'React' ? reactQuestions : getSkillQuestions(skill) || generalQuestions,
    );
  },
  reset() {
    memory = structuredClone(initialData);
    if (typeof window !== 'undefined') localStorage.removeItem('campuslink-data');
  },
};
