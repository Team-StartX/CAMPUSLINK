import { describe, expect, it } from 'vitest';
import { initialData } from '@/mocks/data';
import { migratePlacement } from '@/mocks/placement';
import { readiness, fit, placementSummary } from './scoring';
describe('explainable placement scoring', () => {
  it('matches a manually calculated reference score and readiness ceiling', () => {
    const d = structuredClone(initialData);
    migratePlacement(d);
    const student = {
      ...d.student,
      cgpa: 9,
      skills: [
        { id: 'react', name: 'React', verified: true, level: 'Advanced' },
        { id: 'sql', name: 'SQL', verified: true, level: 'Advanced' },
      ],
      projects: ['React interface', 'SQL analytics'],
      records: { Certifications: ['React certificate', 'SQL certificate'] },
    };
    const history = [
      {
        id: 'reference',
        assessmentId: 'react',
        name: 'React assessment',
        type: 'Skill',
        score: 100,
        points: 0,
        date: '2026-10-02',
        seconds: 60,
      },
    ];
    const drive = { ...d.drives.find((r) => r.status === 'ACTIVE')!, skills: 'React, SQL' };
    expect(fit(student, drive, history).score).toBe(99); // 45 + 20 + 15 + 5 + 13.5, rounded.
    const fullHistory = ['Aptitude', 'Communication', 'Interview'].map((type) => ({
      ...history[0],
      id: type,
      type,
    }));
    expect(
      readiness(
        { ...student, cgpa: 10, projects: [...student.projects, 'Third project'] },
        fullHistory,
      ).score,
    ).toBe(100);
  });
  it('scores at least three simulated active drives within a bounded score range', () => {
    const d = structuredClone(initialData);
    migratePlacement(d);
    const drives = d.drives.filter((r) => r.status === 'ACTIVE');
    expect(drives.length).toBeGreaterThanOrEqual(3);
    const start = performance.now();
    for (let i = 0; i < 1000; i++)
      for (const drive of drives) {
        const result = fit(d.student, drive, d.history);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
    console.info(
      `Scoring evaluation: ${drives.length * 1000} pairs in ${(performance.now() - start).toFixed(1)} ms (including assertions).`,
    );
  });
  it('does not award readiness evidence that is absent', () => {
    const student = { ...initialData.student, cgpa: 0, skills: [], projects: [] };
    expect(readiness(student, [])).toMatchObject({ score: 0, label: 'Not Ready' });
    expect(readiness(student, []).categories.every((c) => !c.recorded)).toBe(true);
  });
  it('distinguishes a recorded zero-score attempt from missing assessment evidence', () => {
    const result = readiness({ ...initialData.student, cgpa: 0, skills: [], projects: [] }, [
      {
        id: 'zero',
        assessmentId: 'aptitude',
        name: 'Aptitude',
        type: 'Aptitude',
        score: 0,
        points: 0,
        date: '2026-10-04',
        seconds: 60,
      },
    ]);
    expect(result.categories.find((c) => c.name === 'Aptitude')).toMatchObject({
      score: 0,
      recorded: true,
    });
    expect(result.categories.find((c) => c.name === 'Interview')).toMatchObject({
      score: 0,
      recorded: false,
    });
  });
  it('recomputes readiness after verification and interview practice', () => {
    const before = readiness(initialData.student, []).score;
    const after = readiness(
      {
        ...initialData.student,
        skills: initialData.student.skills.map((s) => ({ ...s, verified: true })),
      },
      [
        {
          id: 'test',
          assessmentId: 'interview',
          name: 'Mock interview',
          type: 'Interview',
          score: 100,
          points: 0,
          date: '2026-10-02',
          seconds: 60,
        },
      ],
    );
    expect(after.score).toBeGreaterThan(before);
  });
  it('gates scoring on eligibility even when skills are present', () => {
    const d = structuredClone(initialData);
    migratePlacement(d);
    const drive = d.drives.find((r) => r.status === 'ACTIVE')!;
    expect(fit({ ...d.student, cgpa: 0 }, drive, d.history).score).toBe(0);
  });
  it('explains missing and unverified required skills', () => {
    const d = structuredClone(initialData);
    migratePlacement(d);
    const drive = {
      ...d.drives.find((r) => r.status === 'ACTIVE')!,
      skills: 'React, MissingTechnology',
    };
    const result = fit(d.student, drive, []);
    expect(result.gaps.map((g) => g.name)).toEqual(['React', 'MissingTechnology']);
    expect(result.explanation.find((c) => c.name === 'Skill alignment')?.score).toBe(25);
  });
  it('counts a student once when several offers are accepted', () => {
    const d = structuredClone(initialData);
    d.offers = d.offers.map((o) => ({ ...o, status: 'Accepted' }));
    const summary = placementSummary(d);
    expect(summary.registered).toBe(1);
    expect(summary.conversion).toBe(100);
    expect(summary.accepted).toBe(d.offers.length);
  });
});
