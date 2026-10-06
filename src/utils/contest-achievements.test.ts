import { describe, it, expect } from 'vitest';
import { initialData } from '@/mocks/data';
import { contestAchievements, contestDay, recordContestCompletion } from './contest-achievements';

const at = (day: string) => new Date(`${day}T10:00:00Z`);
function finishes(dates: string[]) {
  const data = structuredClone(initialData);
  data.history = [];
  dates.forEach((date, index) => {
    const contest = { ...data.contests[0], id: `contest-${index}`, joined: true, completed: false };
    data.contests.push(contest);
    recordContestCompletion(data, contest, 100, 30, at(date));
  });
  return data;
}
describe('contest achievements', () => {
  it('uses IST consistently across the midnight boundary', () => {
    expect(contestDay(new Date('2026-10-05T18:29:59Z'))).toBe('2026-10-05');
    expect(contestDay(new Date('2026-10-05T18:30:00Z'))).toBe('2026-10-06');
  });
  it('does not award achievements for registration or assessment attempts', () => {
    const data = structuredClone(initialData);
    data.contests[0].joined = true;
    const result = contestAchievements(data, at('2026-10-06'));
    expect(result.completed).toBe(0);
    expect(result.badges.every((b) => b.earnedOn === null)).toBe(true);
  });
  it('counts multiple contests on one day once for streaks and ignores duplicate attempts', () => {
    const data = finishes(['2026-10-04', '2026-10-05', '2026-10-05', '2026-10-06']);
    data.history.push({ ...data.history[0], id: 'duplicate' });
    const result = contestAchievements(data, at('2026-10-06'));
    expect(result).toMatchObject({
      completed: 4,
      currentStreak: 3,
      longestStreak: 3,
      completedToday: true,
    });
    expect(result.badges.find((b) => b.id === 'challenger')?.earnedOn).toBe('2026-10-05');
    expect(result.badges.find((b) => b.id === 'three-day-spark')?.earnedOn).toBe('2026-10-06');
  });
  it('allows today to extend yesterday’s streak, resets after a missed day, and retains earned badges', () => {
    const data = finishes([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(contestAchievements(data, at('2026-10-05')).currentStreak).toBe(7);
    const result = contestAchievements(data, at('2026-10-06'));
    expect(result).toMatchObject({ currentStreak: 0, longestStreak: 7 });
    expect(result.badges.find((b) => b.id === 'weekly-momentum')?.earnedOn).toBe('2026-10-04');
    expect(result.recentDays).toHaveLength(7);
  });
  it('retains tagged completions after a contest is removed and supports existing contest history', () => {
    const data = finishes(['2026-10-06']);
    data.contests = [];
    expect(contestAchievements(data, at('2026-10-06')).completed).toBe(1);
    const legacy = finishes(['2026-10-06']);
    delete legacy.history[0].activity;
    expect(contestAchievements(legacy, at('2026-10-06')).completed).toBe(1);
  });
  it('awards points and completion only once, including replay with a stale completed flag', () => {
    const data = structuredClone(initialData),
      contest = data.contests[0];
    const xp = data.student.xp;
    recordContestCompletion(data, contest, 175, 30, at('2026-10-06'));
    recordContestCompletion(data, contest, 175, 30, at('2026-10-06'));
    contest.completed = false;
    recordContestCompletion(data, contest, 175, 30, at('2026-10-06'));
    expect(data.student.xp).toBe(xp + 175);
    expect(data.history.filter((h) => h.activity === 'contest')).toHaveLength(1);
  });
});
