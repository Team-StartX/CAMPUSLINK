'use client';

import { useId, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AssessmentAttempt } from '@/types';

const colors = ['#7660ad', '#387b68', '#bd7135', '#497bb5', '#ba587d', '#68717f'];
const tooltipStyle = { borderRadius: 12, border: '1px solid #dedbe7', fontSize: 12 };
export type ChartRow = { name: string; [key: string]: string | number };
type Series = { key: string; label: string };

function ChartFrame({
  title,
  description,
  children,
  rows,
  series,
  empty,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  rows: ChartRow[];
  series: Series[];
  empty: boolean;
}) {
  const id = useId();
  return (
    <section className="panel analytics-chart-panel" aria-labelledby={id}>
      <header className="analytics-chart-heading">
        <h3 id={id}>{title}</h3>
        {description && <p>{description}</p>}
      </header>
      {empty ? <p className="analytics-chart-empty">No records to chart yet.</p> : children}
      {!empty && (
        <details className="analytics-chart-data">
          <summary>View chart data</summary>
          <div className="analytics-table-scroll">
            <table>
              <caption>{title}</caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  {series.map((s) => (
                    <th scope="col" key={s.key}>
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.name}-${i}`}>
                    <th scope="row">{row.name}</th>
                    {series.map((s) => (
                      <td key={s.key}>{row[s.key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

export function ComparisonChart({
  title,
  description,
  rows,
  series,
  detailSeries = [],
  percent = false,
  stacked = false,
}: {
  title: string;
  description?: string;
  rows: ChartRow[];
  series: Series[];
  detailSeries?: Series[];
  percent?: boolean;
  stacked?: boolean;
}) {
  const empty = percent
    ? !rows.length
    : !rows.some((row) => series.some((s) => Number(row[s.key]) > 0));
  return (
    <ChartFrame {...{ title, description, rows, empty }} series={[...series, ...detailSeries]}>
      <div
        className="analytics-chart-canvas"
        style={{ height: Math.max(230, rows.length * 44 + 65) }}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            accessibilityLayer
            data={rows}
            layout="vertical"
            margin={{ top: 8, right: 24, bottom: 8, left: 0 }}
          >
            <CartesianGrid horizontal={false} stroke="#e8e5ed" strokeDasharray="3 5" />
            <XAxis
              type="number"
              domain={percent ? [0, 100] : [0, 'auto']}
              allowDecimals={percent}
              tickFormatter={(v) => `${v}${percent ? '%' : ''}`}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: '#f2eff8' }}
              formatter={(v) => (percent ? `${v}%` : v)}
            />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={colors[i % colors.length]}
                stackId={stacked ? 'total' : undefined}
                radius={stacked ? 0 : [0, 5, 5, 0]}
                maxBarSize={22}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function DistributionChart({
  title,
  description,
  rows,
  unit = 'records',
}: {
  title: string;
  description?: string;
  rows: { name: string; value: number }[];
  unit?: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <ChartFrame
      {...{ title, description, rows }}
      series={[{ key: 'value', label: unit }]}
      empty={total === 0}
    >
      <div className="analytics-distribution">
        <div className="analytics-donut">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart accessibilityLayer>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="name"
                innerRadius="65%"
                outerRadius="90%"
                paddingAngle={total > 1 ? 2 : 0}
                isAnimationActive={false}
              >
                {rows.map((r, i) => (
                  <Cell key={r.name} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [v, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="analytics-donut-total" aria-hidden="true">
            <strong>{total.toLocaleString()}</strong>
            <span>{unit}</span>
          </div>
        </div>
        <ul className="analytics-chart-legend">
          {rows.map((r, i) => (
            <li key={r.name}>
              <i style={{ backgroundColor: colors[i % colors.length] }} aria-hidden="true" />
              <span>{r.name}</span>
              <b>{r.value.toLocaleString()}</b>
              <small>{Math.round((100 * r.value) / Math.max(1, total))}%</small>
            </li>
          ))}
        </ul>
      </div>
    </ChartFrame>
  );
}

export function AssessmentScoreTrend({ history }: { history: AssessmentAttempt[] }) {
  const rows = [...history]
    .filter((a) => Number.isFinite(a.score) && Number.isFinite(Date.parse(a.date)))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .slice(-12)
    .map((a) => ({
      name: `${new Date(a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${a.name}`,
      score: a.score,
    }));
  return (
    <ChartFrame
      title="Your score trend"
      description="Your last 12 recorded attempts, in order of completion. Scores are percentages."
      rows={rows}
      series={[{ key: 'score', label: 'Score (%)' }]}
      empty={!rows.length}
    >
      <div className="analytics-chart-canvas" style={{ height: 250 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart
            accessibilityLayer
            data={rows}
            margin={{ top: 16, right: 18, bottom: 12, left: -15 }}
          >
            <CartesianGrid vertical={false} stroke="#e8e5ed" strokeDasharray="3 5" />
            <XAxis
              dataKey="name"
              tickFormatter={(v) => String(v).split(' · ')[0]}
              minTickGap={24}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Score']} />
            <Line
              type="linear"
              dataKey="score"
              name="Score"
              stroke={colors[0]}
              strokeWidth={3}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function countCategories(values: string[]) {
  return Object.entries(
    values.reduce<Record<string, number>>((counts, name) => {
      counts[name] = (counts[name] || 0) + 1;
      return counts;
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}
