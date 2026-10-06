'use client';
import Link from 'next/link';
import { Award, Flame, LockKeyhole, Trophy, ArrowUpRight, Check } from 'lucide-react';
import { Progress, formatDate } from './ui';
import type { ContestAchievements } from '@/utils/contest-achievements';

export function ContestProgress({
  achievements: a,
  compact = false,
}: {
  achievements: ContestAchievements;
  compact?: boolean;
}) {
  const earned = a.badges.filter((badge) => badge.earnedOn).length;
  if (compact)
    return (
      <Link href="/student/contests#achievements" className="contest-progress-preview panel">
        <span className="contest-progress-icon">
          <Flame size={25} />
        </span>
        <div>
          <strong>{a.currentStreak} day contest streak</strong>
          <p>
            {earned} badges earned · {a.completed} contests completed
          </p>
        </div>
        <span>
          View achievements <ArrowUpRight size={16} />
        </span>
      </Link>
    );
  return (
    <section
      className="contest-progress"
      id="achievements"
      aria-labelledby="contest-progress-title"
    >
      <div className="section-header">
        <div>
          <h2 id="contest-progress-title">Small wins. Lasting momentum.</h2>
          <p>Complete contests to build your streak and unlock badges.</p>
        </div>
        <span className="badge">
          <Award size={14} /> {earned} of {a.badges.length} earned
        </span>
      </div>
      <div className="contest-stats-grid">
        <div className="panel lavender contest-streak-panel">
          <span className="contest-stat-label">
            <Flame size={18} /> Current streak
          </span>
          <strong>
            {a.currentStreak} <small>{a.currentStreak === 1 ? 'day' : 'days'}</small>
          </strong>
          <p>
            {a.completedToday
              ? 'Today’s contest is complete. Keep it going tomorrow.'
              : a.currentStreak
                ? 'Complete a contest today to keep your streak going.'
                : 'Your next completed contest starts a new streak.'}
          </p>
          <div className="contest-week" aria-label="Contest completions in the last seven days">
            {a.recentDays.map((day) => (
              <div
                key={day.date}
                title={`${formatDate(day.date)} · ${day.completed ? 'Completed' : 'No completion'}`}
              >
                <span>
                  {new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN', {
                    weekday: 'narrow',
                  })}
                </span>
                <span
                  className={day.completed ? 'completed' : ''}
                  aria-label={`${formatDate(day.date)}: ${day.completed ? 'Completed' : 'No completion'}`}
                >
                  {day.completed ? <Check size={14} /> : '·'}
                </span>
              </div>
            ))}
          </div>
          <small>One streak day per calendar day · India time (IST)</small>
        </div>
        <div className="panel sage contest-stat">
          <span className="contest-stat-label">
            <Trophy size={18} /> Personal best
          </span>
          <strong>
            {a.longestStreak}
            <small> day streak</small>
          </strong>
          <p>Your longest run of consecutive contest days.</p>
        </div>
        <div className="panel yellow contest-stat">
          <span className="contest-stat-label">
            <Award size={18} /> Contests completed
          </span>
          <strong>{a.completed}</strong>
          <p>
            {a.lastCompletedOn
              ? `Last completed on ${formatDate(a.lastCompletedOn)}.`
              : 'Register, solve, and submit a correct solution to earn your first badge.'}
          </p>
        </div>
      </div>
      <div className="contest-badges-grid">
        {a.badges.map((badge) => (
          <article
            className={`panel contest-badge ${badge.earnedOn ? 'earned' : 'locked'}`}
            key={badge.id}
          >
            <span className="contest-badge-icon">
              {badge.earnedOn ? <Award size={25} /> : <LockKeyhole size={22} />}
            </span>
            <span className="contest-badge-status">
              {badge.earnedOn ? 'Earned' : 'In progress'}
            </span>
            <h3>{badge.name}</h3>
            <p>{badge.description}</p>
            {badge.earnedOn ? (
              <small>Earned {formatDate(badge.earnedOn)}</small>
            ) : (
              <>
                <Progress value={(badge.progress / badge.goal) * 100} />
                <small>
                  {badge.progress} / {badge.goal}{' '}
                  {badge.metric === 'streak' ? 'consecutive days' : 'contests'}
                </small>
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
