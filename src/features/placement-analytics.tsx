'use client';
import Link from 'next/link';
import { Download, ArrowUpRight } from 'lucide-react';
import { DemoData, Role } from '@/types';
import { placementSummary } from '@/utils/scoring';
import { Badge, Button, PageHeader, Progress } from '@/components/ui';
import { backendEnabled } from '@/services/api/remote';
import { ConnectedAnalytics } from '@/components/backend-tools';
export function PlacementAnalytics({
  data,
  role,
  reports = false,
}: {
  data: DemoData;
  role: Role;
  reports?: boolean;
}) {
  if (backendEnabled) return <ConnectedAnalytics />;
  const summary = placementSummary(data);
  const metrics = [
    ['Tracked students', summary.registered],
    ['Placement ready', summary.ready],
    ['Active drives', summary.active],
    ['Upcoming drives', summary.upcoming],
    ['Offers made', summary.offers],
    ['Accepted offers', summary.accepted],
    ['Pending offers', summary.pending],
    ['Joined', summary.joined],
  ] as const;
  const download = () => {
    const rows = [
      ['Metric', 'Value'],
      ...metrics.map(([name, value]) => [name, String(value)]),
      ['Average CTC (LPA)', String(summary.average)],
      ['Highest CTC (LPA)', String(summary.highest)],
      ['Verified documents', String(summary.verified)],
    ];
    const url = URL.createObjectURL(
      new Blob(
        [rows.map((row) => row.map((c) => `"${c.replaceAll('"', '""')}"`).join(',')).join('\n')],
        { type: 'text/csv' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'campuslink-placement-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeader
        title={reports ? 'Placement, on record.' : 'Your placement command centre.'}
        description="Follow the current placement cycle from preparation to joining."
        action={
          <Button kind="outline" onClick={download}>
            <Download size={16} /> Export current report
          </Button>
        }
      />
      <div className="filter-bar">
        <Badge>Live local demo · {summary.registered} tracked student</Badge>
        <p>Candidate preview personas are excluded from outcome counts.</p>
      </div>
      <div className="metrics-grid">
        {metrics.map(([label, value], i) => (
          <div
            className={`metric-card ${['lavender', 'sage', 'yellow', 'pink'][i % 4]}`}
            key={label}
          >
            <span>{label}</span>
            <b>{value}</b>
            <p>Current recorded activity</p>
          </div>
        ))}
      </div>
      <div className="two-columns">
        <section className="panel">
          <h3>Branch conversion</h3>
          <p>
            {data.student.branch || data.student.course} · {summary.registered} student
          </p>
          <Progress value={summary.conversion} />
          <p>
            {summary.conversion}% with an accepted offer. Multiple offers count as one placed
            student.
          </p>
          <h3>Skill-wise conversion</h3>
          {data.student.skills
            .filter((s) => s.verified)
            .map((s) => (
              <div className="gap-row" key={s.id}>
                <b>{s.name}</b>
                <Progress value={summary.conversion} />
                <span>{summary.conversion}% · n=1</span>
              </div>
            ))}
          <p className="muted">
            This small sample describes recorded outcomes; it cannot establish a skill’s effect on
            placement.
          </p>
        </section>
        <section className="panel sage">
          <h3>Packages & joining</h3>
          <div className="detail-list">
            <span>
              Average offer CTC<b>{summary.average || '—'} LPA</b>
            </span>
            <span>
              Highest offer CTC<b>{summary.highest || '—'} LPA</b>
            </span>
            <span>
              Joining recorded<b>{summary.joined}</b>
            </span>
            <span>
              Verified documents
              <b>
                {summary.verified} / {summary.documents}
              </b>
            </span>
          </div>
          <p>
            For package ranges, the lower quoted value is used. All recorded offers are included.
          </p>
          <Link className="text-link" href={`/${role}/offers`}>
            Review offer pipeline <ArrowUpRight size={15} />
          </Link>
          <Link className="text-link" href={`/${role}/documents`}>
            Review pending documentation <ArrowUpRight size={15} />
          </Link>
        </section>
      </div>
      <div className="two-columns">
        <section className={`panel ${summary.atRisk ? 'yellow' : 'sage'}`}>
          <Badge>Explainable support indicator</Badge>
          <h3>
            {summary.atRisk
              ? `${data.student.name} needs preparation support`
              : 'Preparation is progressing'}
          </h3>
          <p>
            Readiness {summary.readiness.score}/100 · {summary.readiness.label}
          </p>
          {summary.readiness.factors.map((f) => (
            <p key={f}>{f}</p>
          ))}
          <p className="muted">
            Flagged when readiness is below 70 and no offer is accepted. A rule-based triage signal,
            not a probability or a hiring decision.
          </p>
          <Link
            className="text-link"
            href={`/${role}/${role === 'recruiter' ? 'candidates' : 'students'}/${data.student.id}`}
          >
            Review student evidence <ArrowUpRight size={15} />
          </Link>
        </section>
        <section className="panel">
          <h3>Recruiter engagement</h3>
          {Array.from(new Set(data.drives.map((d) => d.company))).map((company) => {
            const drives = data.drives.filter((d) => d.company === company);
            return (
              <div className="detail-list" key={company}>
                <span>
                  {company}
                  <b>
                    {drives.length} request{drives.length === 1 ? '' : 's'}
                  </b>
                </span>
                <p>{drives.map((d) => d.status.toLowerCase().replaceAll('_', ' ')).join(' · ')}</p>
              </div>
            );
          })}
          <p className="muted">
            Repeated requests show engagement; repeat hiring requires completed outcome history.
          </p>
        </section>
      </div>
    </>
  );
}
