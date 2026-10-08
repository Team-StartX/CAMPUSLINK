'use client';
import { Loader } from '@/components/loader';
import { ConnectedCompany } from '@/components/backend-tools';
import { ContestProgress } from '@/components/contest-progress';
import { Badge, Button, EmptyState, PageHeader } from '@/components/ui';
import { usePlatform } from '@/hooks/use-platform';
import { apiClient } from '@/services/api/client';
import { rpc } from '@/services/api/remote';
import { campusService, recruiterService } from '@/services/platform.service';
import { useSession } from '@/store/session';
import { WorkspaceData, Role, Student } from '@/types';
import { checkEligibility } from '@/utils/placement';
import { fit } from '@/utils/scoring';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Plus,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { CareerID } from './student-dashboard';
import { InstituteStudentEditor } from './institute-student-editor';
import { StudentCohortOverview } from '@/components/student-cohort-overview';
type Props = {
  data: WorkspaceData;
  role: Role;
  id?: string;
  refresh: () => void;
  notify: (s: string) => void;
};
export function PeoplePage({ data, role, id, refresh, notify }: Props) {
  const user = useSession((s) => s.user);
  const client = useQueryClient();
  const peopleKey = ['people', role, user?.id];
  const {
    data: people,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: peopleKey,
    queryFn: role === 'campus' ? campusService.getStudents : recruiterService.getCandidates,
    enabled: Boolean(user?.id),
    refetchInterval: 15000,
  });
  const [editing, setEditing] = useState<Student | null>(null);
  const closeEditor = useCallback(() => setEditing(null), []);
  const {
    data: achievements,
    isLoading: loadingAchievements,
    error: achievementsError,
  } = useQuery({
    queryKey: ['student-achievements', user?.id, id],
    queryFn: () => campusService.getStudentAchievements(id!),
    enabled: role === 'campus' && Boolean(id && people?.some((p) => p.id === id)),
  });
  const editor = editing && (
    <InstituteStudentEditor
      student={editing}
      onClose={closeEditor}
      onSaved={(updated) => {
        client.setQueryData<Student[]>(peopleKey, (list) =>
          list?.map((p) => (p.id === updated.id ? updated : p)),
        );
        void client.invalidateQueries({ queryKey: peopleKey });
        void client.invalidateQueries({ queryKey: ['candidate-ranking'] });
        closeEditor();
        refresh();
        notify('Student record updated.');
      }}
    />
  );
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('All students');
  const [driveId, setDriveId] = useState(
    data.drives.find((d) => ['ACTIVE', 'IN_PROGRESS'].includes(d.status))?.id || '',
  );
  const selectedDrive = data.drives.find((d) => d.id === driveId);
  const { data: ranking } = useQuery<
    {
      student: {
        id: string;
      };
      hybridScore: number;
      nlpSimilarity: number;
    }[]
  >({
    queryKey: ['candidate-ranking', driveId],
    queryFn: async () => (await apiClient.get(`/drives/${driveId}/matches`)).data,
    enabled: Boolean(driveId),
  });
  const shortlisted = data.shortlisted || [];
  const setShortlisted = async (action: (s: string[]) => string[]) => {
    const next = action(shortlisted);
    const id = next.find((id) => !shortlisted.includes(id));
    if (id) {
      {
        try {
          await rpc('studentService', 'getDashboard');
          await apiClient.post(
            '/services/recruiterService/shortlistStudent',
            { args: [id] },
            { headers: { 'X-Student-ID': id } },
          );
        } catch (e) {
          notify((e as Error).message);
          return false;
        }
      }
    }
    await refresh();
    return true;
  };
  const person = people?.find((p) => p.id === id);
  const filteredPeople = (people || [])
    .filter(
      (p) =>
        `${p.name} ${p.id} ${p.course} ${p.branch || ''} ${p.skills.map((s) => s.name).join(' ')}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (status !== 'CGPA 8.5+' || p.cgpa >= 8.5) &&
        (status !== 'Shortlisted' || shortlisted.includes(p.id)),
    )
    .sort((a, b) =>
      selectedDrive
        ? (ranking?.find((r) => r.student.id === b.id)?.hybridScore || 0) -
          (ranking?.find((r) => r.student.id === a.id)?.hybridScore || 0)
        : a.name.localeCompare(b.name),
    );
  const pages = Math.max(1, Math.ceil(filteredPeople.length / 12));
  const currentPage = Math.min(page, pages);
  if (error)
    return (
      <EmptyState title="Student records are unavailable" description={(error as Error).message} />
    );
  if (isLoading) return <Loader label="Loading college student records…" />;
  if (id && !person)
    return (
      <EmptyState
        title="Student unavailable"
        description="This student is not in your institute or authorized candidate list."
      />
    );
  if (id && person)
    return (
      <>
        <PageHeader
          title={person.name}
          description={`${person.course} · ${person.campus}`}
          action={
            role === 'campus' ? (
              <Button onClick={() => setEditing(person)}>Edit student record</Button>
            ) : selectedDrive?.workflowVersion === 2 ? (
              <Link className="button dark" href={`/recruiter/drives/${selectedDrive.id}`}>
                Review selection rounds <ArrowUpRight size={16} />
              </Link>
            ) : (
              <Button
                disabled={
                  shortlisted.includes(person.id) ||
                  (role === 'recruiter' &&
                    (!selectedDrive || !checkEligibility(person, selectedDrive).passed))
                }
                onClick={async () => {
                  if (await setShortlisted((s) => [...s, person.id]))
                    notify('Candidate added to the shortlist.');
                }}
              >
                Shortlist candidate <Check size={16} />
              </Button>
            )
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
        {role === 'campus' ? (
          achievements ? (
            <ContestProgress achievements={achievements} />
          ) : (
            <section className="panel">
              <p role="status">
                {loadingAchievements
                  ? 'Loading contest achievements…'
                  : achievementsError
                    ? 'Could not load contest achievements. Refresh to try again.'
                    : 'No contest achievements available.'}
              </p>
            </section>
          )
        ) : (
          <section className="panel">
            <h3>Assessment performance</h3>
            <p>No assessment records are available for this student.</p>
          </section>
        )}
        {editor}
      </>
    );
  return (
    <>
      <PageHeader
        title={
          role === 'campus' ? 'Every student. A possibility.' : 'Meet your next great teammate.'
        }
        description={
          role === 'campus'
            ? `${people?.length || 0} registered students linked to your college. Choose a placement to check eligibility.`
            : 'Discover verified skills, projects, assessment activity, and ambition.'
        }
      />
      <StudentCohortOverview people={people || []} />
      <div className="filter-bar student-directory-filters">
        {role !== 'student' && (
          <select
            aria-label="Select active campus drive"
            value={driveId}
            onChange={(e) => {
              setDriveId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Choose a placement to check eligibility</option>
            {data.drives
              .filter((d) => role === 'campus' || ['ACTIVE', 'IN_PROGRESS'].includes(d.status))
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
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, ID, branch, or skill…"
          />
        </label>
        <select
          aria-label="Filter students"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option>All students</option>
          <option>CGPA 8.5+</option>
          <option>Shortlisted</option>
        </select>
      </div>
      <div className="table-wrap panel student-directory">
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
            {filteredPeople.slice((currentPage - 1) * 12, currentPage * 12).map((p) => (
              <tr key={p.id}>
                <td>
                  <Link
                    className="student-record-link"
                    href={`/${role}/${role === 'campus' ? 'students' : 'candidates'}/${p.id}`}
                  >
                    <b>{p.name}</b>
                    <small>
                      {p.branch || p.course} · {p.year}
                    </small>
                  </Link>
                </td>
                <td>
                  <div className="student-mini-stat">
                    <b>{p.cgpa.toFixed(1)}</b>
                    <progress aria-label={`${p.name} CGPA`} max={10} value={p.cgpa} />
                  </div>
                </td>
                <td>
                  <div className="student-mini-stat">
                    <span>
                      {p.skills.filter((s) => s.verified).length} / {p.skills.length}
                    </span>
                    <progress
                      aria-label={`${p.name} verified skills`}
                      max={Math.max(1, p.skills.length)}
                      value={p.skills.filter((s) => s.verified).length}
                    />
                  </div>
                </td>
                <td>{p.xp.toLocaleString()} XP</td>
                <td>
                  {selectedDrive
                    ? `${ranking?.find((r) => r.student.id === p.id)?.hybridScore || 0}% hybrid fit`
                    : 'Select a drive'}
                </td>
                <td>
                  {selectedDrive ? (
                    <>
                      <Badge kind={checkEligibility(p, selectedDrive).passed ? 'verified' : ''}>
                        {checkEligibility(p, selectedDrive).passed ? 'Eligible' : 'Not eligible'}
                      </Badge>
                      {!checkEligibility(p, selectedDrive).passed && (
                        <details>
                          <summary>Why not eligible?</summary>
                          {checkEligibility(p, selectedDrive)
                            .checks.filter((check) => !check.passed)
                            .map((check) => (
                              <p key={check.name}>
                                {check.name}: {check.detail}
                              </p>
                            ))}
                        </details>
                      )}
                    </>
                  ) : (
                    <Badge>{shortlisted.includes(p.id) ? 'Shortlisted' : 'Registered'}</Badge>
                  )}
                </td>
                <td>
                  {role === 'campus' ? (
                    <button className="text-button" onClick={() => setEditing(p)}>
                      Edit record <ArrowUpRight size={14} />
                    </button>
                  ) : selectedDrive?.workflowVersion === 2 ? (
                    <Link className="text-link" href={`/recruiter/drives/${selectedDrive.id}`}>
                      Review selection <ArrowUpRight size={14} />
                    </Link>
                  ) : (
                    <button
                      className="text-button"
                      disabled={
                        shortlisted.includes(p.id) ||
                        !selectedDrive ||
                        !checkEligibility(p, selectedDrive).passed
                      }
                      onClick={async () => {
                        if (await setShortlisted((s) => [...s, p.id]))
                          notify(`${p.name} shortlisted.`);
                      }}
                    >
                      Shortlist <Plus size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {Boolean(people?.length) && !filteredPeople.length && (
        <EmptyState
          title="No students match these filters"
          description="Try another name, branch, skill or filter."
        />
      )}
      {filteredPeople.length > 0 && (
        <nav className="directory-pagination" aria-label="Student list pages">
          <span>
            {(currentPage - 1) * 12 + 1}–{Math.min(currentPage * 12, filteredPeople.length)} of{' '}
            {filteredPeople.length} students
          </span>
          <div>
            <Button
              kind="outline"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft size={16} /> Previous
            </Button>
            <span>
              Page {currentPage} of {pages}
            </span>
            <Button
              kind="outline"
              disabled={currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next <ChevronRight size={16} />
            </Button>
          </div>
        </nav>
      )}
      {!people?.length && (
        <EmptyState
          title={
            role === 'campus' && !user?.campusId
              ? 'Your account has no college linked'
              : role === 'campus'
                ? 'No students linked to this college yet'
                : 'No student applications yet'
          }
          description={
            role === 'campus' && !user?.campusId
              ? 'A campus-team account needs a college link to view its students. Ask an administrator to check your account’s college.'
              : role === 'campus'
                ? 'Students must register and select this college. Accounts without a college link, or registered with another college, do not appear here.'
                : 'Students appear in your candidate list after applying to one of your placements.'
          }
          action={
            <Button kind="outline" onClick={() => void refetch()}>
              Refresh students
            </Button>
          }
        />
      )}
      {editor}
    </>
  );
}
export { PlacementAnalytics as AnalyticsPage } from './placement-analytics';
export function SchedulingPage({ data, role }: Props) {
  const [view, setView] = useState('Month');
  const [month, setMonth] = useState(9);
  const [day, setDay] = useState(6);
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
export function RecruitersPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading, error } = usePlatform();
  const companies = [...new Set(data?.drives.map((drive) => drive.company) || [])];
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
      {isLoading ? (
        <Loader compact label="Loading recruiters…" />
      ) : error ? (
        <p role="alert">Could not load recruiter records.</p>
      ) : companies.length === 0 ? (
        <EmptyState
          title="No recruiters yet"
          description="Recruiters appear here when they submit a drive to your campus."
        />
      ) : null}
      <div className="three-columns">
        {companies
          .filter((s) => s.toLowerCase().includes(search.toLowerCase()))
          .map((company) => (
            <section className="panel" key={company}>
              <span className="company-logo lavender">{company[0]}</span>
              <h3>{company}</h3>
              <Badge>Campus drive recruiter</Badge>
              <p>
                {data?.drives.filter((drive) => drive.company === company).length} campus drive(s)
              </p>
              <Link href="/campus/drives" className="text-link">
                View placement drives <ArrowUpRight size={16} />
              </Link>
            </section>
          ))}
      </div>
    </>
  );
}
export function CompanyPage() {
  return <ConnectedCompany />;
}
