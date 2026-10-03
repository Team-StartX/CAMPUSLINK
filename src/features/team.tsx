'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Plus,
  Search,
  Check,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
} from 'lucide-react';
import { DemoData, Role } from '@/types';
import { recruiterService, demoService } from '@/services/platform.service';
import { Badge, Button, EmptyState, FormField, PageHeader } from '@/components/ui';
import { AnalyticsChart, CareerID } from './dashboard';
import { checkEligibility } from '@/utils/placement';
import { fit } from '@/utils/scoring';
import { backendEnabled, rpc } from '@/services/api/remote';
import { apiClient } from '@/services/api/client';
import { ConnectedCompany } from '@/components/backend-tools';
type Props = {
  data: DemoData;
  role: Role;
  id?: string;
  refresh: () => void;
  notify: (s: string) => void;
};
export function PeoplePage({ data, role, id, refresh, notify }: Props) {
  const { data: people } = useQuery({
    queryKey: ['people'],
    queryFn: recruiterService.getCandidates,
  });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All students');
  const [driveId, setDriveId] = useState(
    data.drives.find((d) => ['ACTIVE', 'IN_PROGRESS'].includes(d.status))?.id || '',
  );
  const selectedDrive = data.drives.find((d) => d.id === driveId);
  const { data: ranking } = useQuery<
    { student: { id: string }; hybridScore: number; nlpSimilarity: number }[]
  >({
    queryKey: ['candidate-ranking', driveId],
    queryFn: async () => (await apiClient.get(`/drives/${driveId}/matches`)).data,
    enabled: backendEnabled && Boolean(driveId),
  });
  const shortlisted = data.shortlisted || [];
  const setShortlisted = async (action: (s: string[]) => string[]) => {
    const next = action(shortlisted);
    const id = next.find((id) => !shortlisted.includes(id));
    if (id) {
      if (backendEnabled) {
        try {
          await rpc('studentService', 'getDashboard');
          await apiClient.post(
            '/services/recruiterService/shortlistStudent',
            { args: [id] },
            { headers: { 'X-Student-ID': id } },
          );
        } catch (e) {
          notify((e as Error).message);
          return;
        }
      } else await recruiterService.shortlistStudent(id);
    }
    refresh();
  };
  const person = people?.find((p) => p.id === id);
  if (id && person)
    return (
      <>
        <PageHeader
          title={person.name}
          description={`${person.course} · ${person.campus}`}
          action={
            <Button
              disabled={
                shortlisted.includes(person.id) ||
                (role === 'recruiter' &&
                  (!selectedDrive || !checkEligibility(person, selectedDrive).passed))
              }
              onClick={() => {
                setShortlisted((s) => [...s, person.id]);
                notify('Candidate added to the shortlist.');
              }}
            >
              Shortlist candidate <Check size={16} />
            </Button>
          }
        />
        <div className="two-columns">
          <CareerID student={person} />
          <section className="panel">
            {selectedDrive && checkEligibility(person, selectedDrive).passed ? (
              <Badge>
                Eligibility passed ·{' '}
                {
                  fit(person, selectedDrive, person.id === data.student.id ? data.history : [])
                    .score
                }
                % rule-based fit
              </Badge>
            ) : (
              <Badge>Eligibility not met · Matching unavailable</Badge>
            )}
            <h2>Potential beyond the resume.</h2>
            {selectedDrive && (
              <div>
                {checkEligibility(person, selectedDrive).checks.map((c) => (
                  <p key={c.name}>
                    {c.passed ? '✓' : '×'} {c.name}: {c.detail}
                  </p>
                ))}
                {fit(
                  person,
                  selectedDrive,
                  person.id === data.student.id ? data.history : [],
                ).explanation.map((c) => (
                  <p key={c.name}>
                    {c.name}: {c.score}/100
                  </p>
                ))}
              </div>
            )}
            <p>{person.bio}</p>
            <div className="job-chips">
              {person.skills
                .filter((s) => s.verified)
                .map((s) => (
                  <Badge kind="verified" key={s.id}>
                    {s.name}
                    <CircleCheck size={13} />
                  </Badge>
                ))}
            </div>
            <p>
              CGPA {person.cgpa} · {person.xp.toLocaleString()} XP · {person.projects.length}{' '}
              projects
            </p>
            <h3>Projects</h3>
            {person.projects.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <Link href={`/${role}/interviews/create`} className="button outline">
              Schedule a conversation <ArrowUpRight size={15} />
            </Link>
          </section>
        </div>
        <section className="panel">
          <h3>Assessment performance · Demo analytics</h3>
          <AnalyticsChart />
        </section>
      </>
    );
  return (
    <>
      <PageHeader
        title={
          role === 'campus' ? 'Every student. A possibility.' : 'Meet your next great teammate.'
        }
        description="Discover verified skills, projects, assessment activity, and ambition."
      />
      <div className="filter-bar">
        {role === 'recruiter' && (
          <select
            aria-label="Select active campus drive"
            value={driveId}
            onChange={(e) => setDriveId(e.target.value)}
          >
            <option value="">Choose an active drive</option>
            {data.drives
              .filter((d) => ['ACTIVE', 'IN_PROGRESS'].includes(d.status))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.company} · {d.role} · {d.campus}
                </option>
              ))}
          </select>
        )}
        <label className="search-input">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, branch, or skill…"
          />
        </label>
        <select
          aria-label="Filter students"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option>All students</option>
          <option>CGPA 8.5+</option>
          <option>Shortlisted</option>
        </select>
      </div>
      <div className="table-wrap panel">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>CGPA</th>
              <th>Verified skills</th>
              <th>Career points</th>
              <th>Role fit</th>
              <th>Status</th>
              <th>Next step</th>
            </tr>
          </thead>
          <tbody>
            {people
              ?.filter(
                (p) =>
                  `${p.name} ${p.id} ${p.course} ${p.skills.map((s) => s.name).join(' ')}`
                    .toLowerCase()
                    .includes(search.toLowerCase()) &&
                  (role === 'campus' ||
                    (!!selectedDrive && checkEligibility(p, selectedDrive).passed)) &&
                  (status !== 'CGPA 8.5+' || p.cgpa >= 8.5) &&
                  (status !== 'Shortlisted' || shortlisted.includes(p.id)),
              )
              .sort((a, b) =>
                selectedDrive
                  ? backendEnabled
                    ? (ranking?.find((r) => r.student.id === b.id)?.hybridScore || 0) -
                      (ranking?.find((r) => r.student.id === a.id)?.hybridScore || 0)
                    : fit(b, selectedDrive, b.id === data.student.id ? data.history : []).score -
                      fit(a, selectedDrive, a.id === data.student.id ? data.history : []).score
                  : b.cgpa - a.cgpa,
              )
              .map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={`/${role}/${role === 'campus' ? 'students' : 'candidates'}/${p.id}`}
                    >
                      <b>{p.name}</b>
                      <small>{p.id} · CSE</small>
                    </Link>
                  </td>
                  <td>{p.cgpa}</td>
                  <td>{p.skills.filter((s) => s.verified).length}</td>
                  <td>{p.xp.toLocaleString()} XP</td>
                  <td>
                    {selectedDrive
                      ? backendEnabled
                        ? `${ranking?.find((r) => r.student.id === p.id)?.hybridScore || 0}% hybrid fit`
                        : `${fit(p, selectedDrive, p.id === data.student.id ? data.history : []).score}%`
                      : 'Select a drive'}
                  </td>
                  <td>
                    <Badge kind="verified">
                      {shortlisted.includes(p.id) ? 'Shortlisted' : 'Placement active'}
                    </Badge>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      disabled={shortlisted.includes(p.id)}
                      onClick={() => {
                        setShortlisted((s) => [...s, p.id]);
                        notify(`${p.name} shortlisted.`);
                      }}
                    >
                      Shortlist <Plus size={14} />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
export { PlacementAnalytics as AnalyticsPage } from './placement-analytics';
export function SchedulingPage({ data, role, notify, refresh: propsRefresh }: Props) {
  const [view, setView] = useState('Month');
  const [month, setMonth] = useState(9);
  const [day, setDay] = useState(6);
  const resolved = !!data.conflictResolved;
  const label = new Date(2026, month, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
  const events = data.interviews.filter((i) => new Date(`${i.date}T12:00:00`).getMonth() === month);
  return (
    <>
      <PageHeader
        title="Make space for what’s next."
        description="A shared calendar for assessments, drives, contests, and interviews."
        action={
          <Link href={`/${role}/interviews/create`} className="button dark">
            <Plus size={16} /> Schedule event
          </Link>
        }
      />
      {!resolved && (
        <div className="info-banner yellow">
          <ClockIcon />
          <div>
            <b>Demo schedule conflict · STU-20482</b>
            <p>
              TCS interview at 10:00 and Infosys at 10:30. Suggested alternative: Infosys at 12:00.
            </p>
          </div>
          <Button
            kind="outline"
            onClick={async () => {
              await demoService.resolveConflict();
              propsRefresh();
              notify('Demo conflict resolved. Infosys moved to 12:00.');
            }}
          >
            Use suggested time
          </Button>
        </div>
      )}
      <div className="panel calendar">
        <div className="panel-header">
          <div className="calendar-controls">
            <button
              aria-label="Previous month"
              className="icon-button"
              onClick={() => setMonth((m) => m - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <h2>{label}</h2>
            <button
              aria-label="Next month"
              className="icon-button"
              onClick={() => setMonth((m) => m + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="filter-pills">
            {['Month', 'Week', 'Day'].map((v) => (
              <button key={v} className={view === v ? 'selected' : ''} onClick={() => setView(v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
        {view === 'Month' ? (
          <>
            <div className="calendar-weekdays">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {Array.from({ length: new Date(2026, month, 1).getDay() }, (_, i) => (
                <div key={`blank-${i}`} className="calendar-blank" />
              ))}
              {Array.from({ length: new Date(2026, month + 1, 0).getDate() }, (_, i) => i + 1).map(
                (d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setDay(d);
                      setView('Day');
                    }}
                  >
                    <b className={d === 2 ? 'today' : ''}>{d}</b>
                    {events
                      .filter((e) => Number(e.date.slice(-2)) === d)
                      .map((e) => (
                        <span key={e.id} className="lavender">
                          {e.time} {e.company}
                        </span>
                      ))}
                    {d === 8 && <span className="yellow">Weekly contest</span>}
                  </button>
                ),
              )}
            </div>
          </>
        ) : (
          <div className="calendar-day">
            <h3>{view === 'Day' ? `${day} ${label}` : `Week of ${day} ${label}`}</h3>
            {events
              .filter((e) => view === 'Week' || Number(e.date.slice(-2)) === day)
              .map((e) => (
                <Link href={`/${role}/interviews/${e.id}`} className="upcoming-row" key={e.id}>
                  <span>{e.time}</span>
                  <div>
                    <b>
                      {e.company} · {e.role}
                    </b>
                    <p>
                      {e.round} · {e.mode}
                    </p>
                  </div>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            {!events.some((e) => view === 'Week' || Number(e.date.slice(-2)) === day) && (
              <EmptyState
                title="Room for your next step."
                description="No interviews scheduled for this date."
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
function ClockIcon() {
  return <CalendarDays size={25} />;
}
export function RecruitersPage() {
  const [search, setSearch] = useState('');
  return (
    <>
      <PageHeader
        title="Partners in possibility."
        description="The recruiting teams connecting your students to their next chapter."
      />
      <label className="search-input">
        <Search size={17} />
        <input
          placeholder="Search recruiters…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="three-columns">
        {['Razorpay', 'Google', 'Atlassian', 'TCS']
          .filter((s) => s.toLowerCase().includes(search.toLowerCase()))
          .map((company) => (
            <section className="panel" key={company}>
              <span className="company-logo lavender">{company[0]}</span>
              <h3>{company}</h3>
              <Badge kind="verified">Campus partner</Badge>
              <p>Graduate engineering opportunities · 2027 cohort</p>
              <Link href="/campus/drives" className="text-link">
                View placement drives <ArrowUpRight size={16} />
              </Link>
            </section>
          ))}
      </div>
    </>
  );
}
export function CompanyPage(props: { notify: (s: string) => void }) {
  return backendEnabled ? <ConnectedCompany /> : <DemoCompanyPage {...props} />;
}
function DemoCompanyPage({ notify }: { notify: (s: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(() => {
    if (typeof window === 'undefined') return 'Razorpay';
    try {
      return JSON.parse(localStorage.getItem('campuslink-company') || '{}').name || 'Razorpay';
    } catch {
      return 'Razorpay';
    }
  });
  const [description, setDescription] = useState(() => {
    const fallback =
      'Building the financial backbone for businesses in India. Our teams create simple, powerful products that help businesses grow.';
    if (typeof window === 'undefined') return fallback;
    try {
      return JSON.parse(localStorage.getItem('campuslink-company') || '{}').description || fallback;
    } catch {
      return fallback;
    }
  });
  return (
    <>
      <PageHeader
        title="Your company’s next chapter."
        description="Help candidates understand the team they could join."
        action={
          <Button kind="outline" onClick={() => setEditing(!editing)}>
            {editing ? 'Cancel' : 'Edit company profile'}
          </Button>
        }
      />
      <section className="panel">
        {editing ? (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              localStorage.setItem('campuslink-company', JSON.stringify({ name, description }));
              setEditing(false);
              notify('Company profile saved.');
            }}
          >
            <FormField label="Company name">
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label="About your company">
              <textarea
                required
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormField>
            <Button type="submit">
              Save company profile <Check size={16} />
            </Button>
          </form>
        ) : (
          <>
            <span className="company-logo lavender">{name[0]}</span>
            <h2>{name}</h2>
            <p>{description}</p>
            <div className="detail-list">
              <span>
                Industry<b>Financial technology</b>
              </span>
              <span>
                Headquarters<b>Bengaluru, India</b>
              </span>
              <span>
                Campus hiring<b>2027 graduates</b>
              </span>
            </div>
            <Link href="/recruiter/drives" className="button outline">
              View your drives <ArrowUpRight size={15} />
            </Link>
          </>
        )}
      </section>
    </>
  );
}
