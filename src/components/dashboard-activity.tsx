'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, BarChart3 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AssessmentAttempt } from '@/types';

export function DashboardActivity({ history }: { history: AssessmentAttempt[] }) {
  const [days, setDays] = useState(14);
  const today = new Date();
  const dateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const activity = Array.from({ length: days }, (_, index) => {
    const date = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - days + index + 1,
    );
    const key = dateKey(date);
    return {
      date: key,
      label: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      count: history.filter((attempt) => attempt.date.slice(0, 10) === key).length,
    };
  });
  const attempts = history.filter((attempt) => {
    const date = attempt.date.slice(0, 10);
    return date >= activity[0].date && date <= dateKey(today);
  });
  const average = attempts.length
    ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length)
    : null;
  const peak = Math.max(...activity.map((day) => day.count));

  return (
    <section className="panel dashboard-activity" aria-label="Assessment activity">
      <div className="panel-header">
        <h3>
          <span className="dashboard-dot lavender" /> Your momentum
        </h3>
        <BarChart3 size={17} aria-hidden="true" />
      </div>
      <div className="activity-totals">
        <div>
          <span>Assessments completed</span>
          <strong>
            {attempts.length}
            <small>in {days} days</small>
          </strong>
        </div>
        <div>
          <span>Average score</span>
          <strong>
            {average === null ? '—' : `${average}%`}
            <small className="activity-score-tag">
              {average === null ? 'Start practicing' : 'Keep growing'}
            </small>
          </strong>
        </div>
      </div>
      <div
        className="activity-chart"
        role="img"
        aria-label={`${attempts.length} assessments completed in the last ${days} days. ${average === null ? 'No scores recorded yet.' : `Average score ${average} percent.`}`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={activity}
            margin={{ top: 8, right: 0, bottom: 0, left: -25 }}
            barCategoryGap={days === 14 ? '28%' : '20%'}
          >
            <CartesianGrid vertical={false} stroke="#e9e7ed" strokeDasharray="3 5" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={days === 14 ? 3 : 6}
              tick={{ fontSize: 9, fill: '#82818d' }}
              minTickGap={15}
            />
            <YAxis
              allowDecimals={false}
              domain={[0, Math.max(3, peak)]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: '#82818d' }}
            />
            <Tooltip
              cursor={{ fill: '#eeeafb' }}
              contentStyle={{ borderRadius: 12, border: '1px solid #e5e1ee', fontSize: 12 }}
              formatter={(value) => [value, 'Assessments']}
            />
            <Bar dataKey="count" radius={[8, 8, 8, 8]} isAnimationActive={false}>
              {activity.map((day) => (
                <Cell
                  key={day.date}
                  fill={day.count === peak && peak > 0 ? '#ac94cf' : '#343740'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {attempts.length === 0 && (
          <p className="activity-empty">Your next assessment starts the story.</p>
        )}
      </div>
      <div className="activity-footer">
        <div className="activity-periods" role="group" aria-label="Activity period">
          {[14, 30].map((period) => (
            <button
              key={period}
              type="button"
              aria-pressed={days === period}
              onClick={() => setDays(period)}
            >
              {period} days
            </button>
          ))}
        </div>
        <Link href="/student/assessments" className="text-link">
          Keep practicing <ArrowUpRight size={14} />
        </Link>
      </div>
    </section>
  );
}
