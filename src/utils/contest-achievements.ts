import type { Contest, DemoData } from '@/types';

// Calendar days are shared by the client and server, regardless of device timezone.
export function contestDay(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86400000;

export function recordContestCompletion(
  data: DemoData,
  contest: Contest,
  points: number,
  seconds: number,
  now = new Date(),
) {
  if (
    contest.completed ||
    data.history.some((h) => h.assessmentId === contest.id && h.activity === 'contest')
  )
    return;
  contest.completed = true;
  data.student.xp += points;
  data.history.unshift({
    id: crypto.randomUUID(),
    assessmentId: contest.id,
    activity: 'contest',
    name: contest.name,
    type: 'Coding',
    score: 100,
    points,
    date: contestDay(now),
    seconds,
  });
}

const badgeRules = [
  {
    id: 'first-finish',
    name: 'First finish',
    description: 'Complete your first contest.',
    goal: 1,
    metric: 'completed',
  },
  {
    id: 'challenger',
    name: 'Challenger',
    description: 'Complete 3 different contests.',
    goal: 3,
    metric: 'completed',
  },
  {
    id: 'contest-explorer',
    name: 'Contest explorer',
    description: 'Complete 5 different contests.',
    goal: 5,
    metric: 'completed',
  },
  {
    id: 'three-day-spark',
    name: 'Three-day spark',
    description: 'Complete a contest on 3 consecutive days.',
    goal: 3,
    metric: 'streak',
  },
  {
    id: 'weekly-momentum',
    name: 'Weekly momentum',
    description: 'Complete a contest on 7 consecutive days.',
    goal: 7,
    metric: 'streak',
  },
] as const;

export function contestAchievements(
  data: Pick<DemoData, 'contests' | 'history'>,
  now = new Date(),
) {
  const seen = new Set<string>();
  const completions = data.history
    .filter(
      (h) =>
        h.score === 100 &&
        (h.activity === 'contest' || data.contests.some((c) => c.id === h.assessmentId)),
    )
    .filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.date) && Number.isFinite(dayNumber(h.date)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((h) => {
      if (seen.has(h.assessmentId)) return false;
      seen.add(h.assessmentId);
      return true;
    });
  const days = [...new Set(completions.map((h) => h.date))];
  let run = 0,
    longestStreak = 0;
  const streakDates = new Map<number, string>();
  days.forEach((date, index) => {
    run = index > 0 && dayNumber(date) - dayNumber(days[index - 1]) === 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    if (!streakDates.has(run)) streakDates.set(run, date);
  });
  const today = contestDay(now),
    lastDay = days.at(-1);
  const age = lastDay ? dayNumber(today) - dayNumber(lastDay) : Infinity;
  const currentStreak = age >= 0 && age <= 1 ? run : 0;
  return {
    currentStreak,
    longestStreak,
    completed: completions.length,
    completedToday: lastDay === today,
    lastCompletedOn: lastDay || null,
    recentDays: Array.from({ length: 7 }, (_, index) => {
      const date = new Date((dayNumber(today) - 6 + index) * 86400000).toISOString().slice(0, 10);
      return { date, completed: days.includes(date) };
    }),
    badges: badgeRules.map((badge) => {
      const progress = badge.metric === 'completed' ? completions.length : longestStreak;
      const earnedOn =
        badge.metric === 'completed'
          ? completions[badge.goal - 1]?.date
          : streakDates.get(badge.goal);
      return { ...badge, progress: Math.min(progress, badge.goal), earnedOn: earnedOn || null };
    }),
  };
}
export type ContestAchievements = ReturnType<typeof contestAchievements>;
