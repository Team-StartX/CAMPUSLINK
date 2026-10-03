'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Building2,
  ClipboardList,
  FileQuestion,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';
import { authService, useSession } from '@/store/session';
import { apiClient } from '@/services/api/client';
import { backendEnabled } from '@/services/api/remote';
import { Logo } from '@/components/public';
import { Badge, Button, EmptyState, FormField, Modal } from '@/components/ui';
import type { AdminData } from '@/types/admin';
import type { User } from '@/types';

const sections = [
  ['dashboard', 'Overview', LayoutDashboard],
  ['accounts', 'Accounts & approvals', Users],
  ['contests', 'Contests', Trophy],
  ['questions', 'Question bank', FileQuestion],
  ['assessments', 'Assessments', ClipboardList],
  ['campuses', 'Campuses', Building2],
  ['activity', 'Activity & services', ShieldCheck],
] as const;
type Kind = 'contests' | 'questions' | 'assessments' | 'campuses';
type Draft = Record<string, string>;
type Editor = { kind: Kind; values: Draft };
const descriptions: Record<string, string> = {
  dashboard: 'Keep your campus ecosystem moving. Review access and publish the next challenge.',
  accounts: 'Review campus and recruiter requests, and manage access to the platform.',
  contests: 'Create short-answer challenges. Publish globally or for a specific campus.',
  questions: 'Build your multiple-choice library. Correct answers stay on the server.',
  assessments: 'Select questions from your bank and publish a timed assessment.',
  campuses: 'Maintain the institutions students and placement teams can join.',
  activity: 'Review administrative changes and connected services.',
};

export function AdminDashboard() {
  const path = usePathname();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void authService.restore().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);
  if (!ready)
    return (
      <div className="empty-state">
        <h2>Opening admin workspace…</h2>
        <p>Checking your access.</p>
      </div>
    );
  if (!backendEnabled)
    return (
      <EmptyState
        title="Connect your backend"
        description="The admin dashboard requires the Express backend. Enable API mode to manage real accounts and content."
      />
    );
  if (!user?.isAdmin || !user.approved || !user.verified)
    return (
      <EmptyState
        title="Administrator access required"
        description="Use a verified account with administrator access granted by the project operator."
        action={
          <Link className="button dark" href="/">
            Back to home
          </Link>
        }
      />
    );
  const section = path.split('/')[2] || 'dashboard';
  return <AdminWorkspace section={section} user={user} />;
}

function AdminWorkspace({ section, user }: { section: string; user: User }) {
  const client = useQueryClient();
  const router = useRouter();
  const { data, isLoading, error } = useQuery<AdminData>({
    queryKey: ['admin', user.id],
    queryFn: async () => (await apiClient.get('/admin')).data,
  });
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  const [revoke, setRevoke] = useState<User | null>(null);
  const heading = sections.find((s) => s[0] === section)?.[1] || 'Page not found';
  useEffect(() => {
    setSearch('');
    setMessage('');
    setFailure('');
  }, [section]);
  async function refresh() {
    await client.invalidateQueries({ queryKey: ['admin'] });
    await client.invalidateQueries({ queryKey: ['platform'] });
    await client.invalidateQueries({ queryKey: ['account-approvals'] });
  }
  async function changeAccess(account: User, approved: boolean) {
    setBusy(true);
    setFailure('');
    setMessage('');
    try {
      await apiClient.patch(`/admin/accounts/${account.id}`, { approved });
      setRevoke(null);
      await refresh();
      setMessage(approved ? 'Account approved.' : 'Account access revoked.');
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function open(kind: Kind, row?: object) {
    const initial: Draft =
      kind === 'questions'
        ? { prompt: '', topic: '', options: '\n\n\n', answer: '0' }
        : kind === 'campuses'
          ? {
              name: '',
              location: '',
              courses: 'B.Tech',
              branches: 'CSE, IT, ECE',
              studentPool: '0',
            }
          : kind === 'assessments'
            ? {
                name: '',
                type: 'Aptitude',
                duration: '10',
                skill: '',
                color: 'lavender',
                status: 'draft',
                campusId: '',
                questionIds: '[]',
              }
            : {
                name: '',
                type: 'Weekly challenge',
                duration: '15',
                points: '100',
                difficulty: 'Easy',
                status: 'draft',
                campusId: '',
                prompt: '',
                answer: '',
              };
    if (row)
      for (const [key, value] of Object.entries(row))
        initial[key] = Array.isArray(value)
          ? key === 'questionIds'
            ? JSON.stringify(value)
            : value.join(key === 'options' ? '\n' : ', ')
          : String(value ?? '');
    setEditor({ kind, values: initial });
    setFailure('');
  }
  async function save(values: Draft, kind: Kind) {
    setBusy(true);
    setFailure('');
    try {
      const common = {
        ...(values.id ? { id: values.id } : {}),
        name: values.name,
        campusId: values.campusId,
      };
      const payload =
        kind === 'questions'
          ? {
              ...(values.id ? { id: values.id } : {}),
              prompt: values.prompt,
              topic: values.topic,
              options: values.options
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
              answer: Number(values.answer),
            }
          : kind === 'campuses'
            ? {
                ...(values.id ? { id: values.id } : {}),
                name: values.name,
                location: values.location,
                studentPool: Number(values.studentPool),
                courses: values.courses
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
                branches: values.branches
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              }
            : kind === 'assessments'
              ? {
                  ...common,
                  type: values.type,
                  duration: Number(values.duration),
                  skill: values.skill,
                  color: values.color,
                  status: values.status,
                  questionIds: JSON.parse(values.questionIds),
                }
              : {
                  ...common,
                  type: values.type,
                  duration: Number(values.duration),
                  points: Number(values.points),
                  difficulty: values.difficulty,
                  status: values.status,
                  prompt: values.prompt,
                  answer: values.answer,
                };
      await apiClient.post(`/admin/${kind}`, payload);
      setEditor(null);
      await refresh();
      setMessage(
        kind === 'questions'
          ? 'Question saved to the question bank.'
          : kind === 'campuses'
            ? 'Campus saved.'
            : values.status === 'published'
              ? 'Published successfully. Students in the selected audience can now access this item.'
              : values.status === 'archived'
                ? 'Archived. This item is now hidden from students.'
                : 'Draft saved. Publish it when you’re ready.',
      );
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const pending = data?.accounts.filter((a) => !a.approved) || [];
  const accountRows =
    data?.accounts.filter(
      (a) =>
        (role === 'all' || a.role === role) &&
        (!pendingOnly || !a.approved) &&
        `${a.name} ${a.email} ${a.organization}`.toLowerCase().includes(search.toLowerCase()),
    ) || [];
  const kind = (
    ['contests', 'questions', 'assessments', 'campuses'].includes(section) ? section : null
  ) as Kind | null;
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Logo dark />
        <div className="admin-workspace-label">
          <ShieldCheck size={20} />
          <span>
            Admin workspace<small>CampusLink control center</small>
          </span>
        </div>
        <nav aria-label="Admin navigation">
          {sections.map(([key, label, Icon]) => (
            <Link
              key={key}
              href={`/admin/${key}`}
              aria-current={section === key ? 'page' : undefined}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <Link href="/">
            View website <ArrowUpRight size={16} />
          </Link>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await authService.logout();
                client.clear();
                router.replace('/login');
              } catch (e) {
                setFailure((e as Error).message);
                setBusy(false);
              }
            }}
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <span>
            <ShieldCheck size={16} /> ADMINISTRATION
          </span>
          <span>
            {user.name}
            <Badge>Administrator</Badge>
          </span>
        </header>
        <div className="admin-heading">
          <div>
            <span className="eyebrow">YOUR PLATFORM, IN ONE PLACE</span>
            <h1>{heading}</h1>
            <p>{descriptions[section]}</p>
          </div>
          {kind && (
            <Button onClick={() => open(kind)}>
              <Plus size={17} />
              Add{' '}
              {kind === 'questions'
                ? 'question'
                : kind === 'campuses'
                  ? 'campus'
                  : kind === 'assessments'
                    ? 'assessment'
                    : 'contest'}
            </Button>
          )}
        </div>
        {message && (
          <p className="admin-notice" role="status">
            {message}
          </p>
        )}
        {failure && !editor && (
          <p className="field-error" role="alert">
            {failure}
          </p>
        )}
        {isLoading ? (
          <div className="panel skeleton">Loading administration data…</div>
        ) : error || !data ? (
          <EmptyState
            title="Unable to load admin data"
            description={error?.message}
            action={<Button onClick={() => void refresh()}>Retry</Button>}
          />
        ) : (
          <>
            {section === 'dashboard' && (
              <>
                <div className="admin-stats">
                  {[
                    ['Total accounts', data.accounts.length, 'lavender'],
                    ['Awaiting approval', pending.length, 'yellow'],
                    [
                      'Published contests',
                      data.contests.filter((c) => c.status === 'published').length,
                      'pink',
                    ],
                    ['Question bank', data.questions.length, 'mint'],
                  ].map(([label, count, color]) => (
                    <div className={`panel ${color}`} key={label}>
                      <span>{label}</span>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>
                <div className="admin-overview-grid">
                  <section className="panel">
                    <div className="panel-header">
                      <h2>Requests to review</h2>
                      <Link className="text-link" href="/admin/accounts">
                        View accounts <ArrowUpRight size={16} />
                      </Link>
                    </div>
                    {pending.length ? (
                      pending.slice(0, 5).map((a) => (
                        <div className="admin-request" key={a.id}>
                          <div>
                            <strong>{a.name}</strong>
                            <p>
                              {a.email} · {a.role}
                            </p>
                          </div>
                          <Button disabled={busy} onClick={() => void changeAccess(a, true)}>
                            Approve
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="muted">No pending account requests.</p>
                    )}
                  </section>
                  <section className="panel admin-publish-panel">
                    <span className="eyebrow">BUILD THE NEXT CHALLENGE</span>
                    <h2>Give students a reason to grow.</h2>
                    <p>Add questions, assemble an assessment, or launch a campus contest.</p>
                    <div>
                      {(['questions', 'assessments', 'contests'] as Kind[]).map((k) => (
                        <Button key={k} kind="outline" onClick={() => open(k)}>
                          <Plus size={15} />
                          Add{' '}
                          {k === 'questions'
                            ? 'question'
                            : k === 'assessments'
                              ? 'assessment'
                              : 'contest'}
                        </Button>
                      ))}
                    </div>
                  </section>
                </div>
                <section className="panel">
                  <h2>Platform at a glance</h2>
                  <div className="admin-summary">
                    {(['student', 'recruiter', 'campus'] as const).map((r) => (
                      <span key={r}>
                        <b>{data.accounts.filter((a) => a.role === r).length}</b>
                        {r === 'student'
                          ? 'Students'
                          : r === 'recruiter'
                            ? 'Recruiters'
                            : 'Campus teams'}
                      </span>
                    ))}
                    <span>
                      <b>{data.campuses.length}</b>Institutions
                    </span>
                  </div>
                </section>
              </>
            )}
            {section === 'accounts' && (
              <section className="panel">
                <div className="admin-filters">
                  <label className="admin-search">
                    <Search size={17} />
                    <input
                      aria-label="Search accounts"
                      placeholder="Search name, email or organization"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Filter account role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="all">All roles</option>
                    <option value="student">Students</option>
                    <option value="campus">Campus teams</option>
                    <option value="recruiter">Recruiters</option>
                  </select>
                  <label>
                    <input
                      type="checkbox"
                      checked={pendingOnly}
                      onChange={(e) => setPendingOnly(e.target.checked)}
                    />{' '}
                    Pending only
                  </label>
                </div>
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th>Role / organization</th>
                        <th>Email</th>
                        <th>Access</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountRows.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <strong>{a.name}</strong>
                            <small>{a.email}</small>
                            {a.isAdmin && <Badge>Admin</Badge>}
                          </td>
                          <td>
                            {a.role}
                            <small>{a.organization}</small>
                          </td>
                          <td>{a.verified ? 'Verified' : 'Awaiting verification'}</td>
                          <td>
                            <Badge>{a.approved ? 'Approved' : 'Pending / revoked'}</Badge>
                          </td>
                          <td>
                            {!a.isAdmin && (
                              <Button
                                kind={a.approved ? 'outline' : 'dark'}
                                disabled={busy}
                                onClick={() =>
                                  a.approved ? setRevoke(a) : void changeAccess(a, true)
                                }
                              >
                                {a.approved ? 'Revoke access' : 'Approve'}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!accountRows.length && (
                  <p className="admin-empty">No accounts match your filters.</p>
                )}
              </section>
            )}
            {kind && (
              <>
                <label className="admin-search admin-content-search">
                  <Search size={17} />
                  <input
                    aria-label={`Search ${kind}`}
                    placeholder={`Search ${kind}`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <div className="admin-content-grid">
                  {data[kind]
                    .filter((row) =>
                      JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((row) => (
                      <article className="panel admin-content-card" key={row.id}>
                        <div className="panel-header">
                          <Badge>
                            {'status' in row
                              ? row.status
                              : kind === 'questions'
                                ? 'topic' in row
                                  ? row.topic
                                  : 'Institution'
                                : 'Institution'}
                          </Badge>
                          <Button kind="outline" onClick={() => open(kind, row)}>
                            Edit
                          </Button>
                        </div>
                        <h2>{'name' in row ? row.name : row.prompt}</h2>
                        {'prompt' in row && 'name' in row && <p>{row.prompt}</p>}
                        {'options' in row && (
                          <ol>
                            {row.options.map((option, i) => (
                              <li key={i}>
                                {option}
                                {i === row.answer && (
                                  <span className="admin-correct"> ✓ Correct</span>
                                )}
                              </li>
                            ))}
                          </ol>
                        )}
                        {'questionIds' in row && (
                          <p>
                            {row.questionIds.length} questions · {row.duration} minutes
                          </p>
                        )}
                        {'points' in row && (
                          <p>
                            {row.difficulty} · {row.points} XP · {row.duration} minutes
                          </p>
                        )}
                        {'location' in row && (
                          <p>
                            {row.location}
                            <br />
                            {row.courses.join(', ')} · {row.branches.join(', ')}
                          </p>
                        )}
                        {'campusId' in row && (
                          <small className="muted">
                            {row.campusId
                              ? data.campuses.find((c) => c.id === row.campusId)?.name
                              : 'All campuses'}
                          </small>
                        )}
                      </article>
                    ))}
                </div>
                {!data[kind].length && (
                  <EmptyState
                    title={`No ${kind} yet`}
                    description="Add your first item using the button above."
                  />
                )}
              </>
            )}
            {section === 'activity' && (
              <>
                <div className="admin-stats">
                  {Object.entries(data.integrations).map(([key, value]) => (
                    <div className="panel" key={key}>
                      <span>{key}</span>
                      <strong className="admin-service-name">{value}</strong>
                    </div>
                  ))}
                </div>
                <section className="panel">
                  <h2>Activity log</h2>
                  <p className="muted">
                    Latest 200 events. Times are shown in your local timezone.
                  </p>
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Event</th>
                          <th>Administrator</th>
                          <th>Target</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.audit.map((event, i) => (
                          <tr key={i}>
                            <td>{event.event.replaceAll('-', ' ')}</td>
                            <td>
                              {data.accounts.find((a) => a.id === event.actorId)?.email ||
                                'Project operator'}
                            </td>
                            <td>
                              {data.accounts.find((a) => a.id === event.targetId)?.email ||
                                event.targetId ||
                                '—'}
                            </td>
                            <td>{new Date(event.time).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!data.audit.length && <p className="admin-empty">No activity recorded yet.</p>}
                </section>
              </>
            )}
          </>
        )}
      </main>
      {editor && data && (
        <ContentEditor
          editor={editor}
          data={data}
          busy={busy}
          error={failure}
          onClose={() => {
            if (!busy) {
              setEditor(null);
              setFailure('');
            }
          }}
          onSave={save}
        />
      )}
      {revoke && (
        <Modal
          title="Revoke account access?"
          onClose={() => {
            if (!busy) setRevoke(null);
          }}
        >
          <p>
            {revoke.email} will lose access to placement features. You can approve the account again
            later.
          </p>
          {failure && (
            <p className="field-error" role="alert">
              {failure}
            </p>
          )}
          <Button disabled={busy} onClick={() => void changeAccess(revoke, false)}>
            {busy ? 'Updating…' : 'Revoke access'}
          </Button>
        </Modal>
      )}
    </div>
  );
}

function ContentEditor({
  editor,
  data,
  busy,
  error,
  onClose,
  onSave,
}: {
  editor: Editor;
  data: AdminData;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: Draft, kind: Kind) => Promise<void>;
}) {
  const [values, setValues] = useState(editor.values);
  const { kind } = editor;
  const update = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const field = (key: string, label: string, type = 'text', optional = false) => (
    <FormField key={key} label={label}>
      {type === 'textarea' ? (
        <textarea
          required={!optional}
          maxLength={2000}
          rows={4}
          value={values[key] || ''}
          onChange={(e) => update(key, e.target.value)}
        />
      ) : (
        <input
          type={type}
          required={!optional}
          min={key === 'points' || key === 'studentPool' ? 0 : 1}
          max={key === 'duration' ? 120 : key === 'points' ? 1000 : undefined}
          value={values[key] || ''}
          onChange={(e) => update(key, e.target.value)}
        />
      )}
    </FormField>
  );
  const select = (key: string, label: string, options: string[]) => (
    <FormField key={key} label={label}>
      <select value={values[key]} onChange={(e) => update(key, e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </FormField>
  );
  const selected: string[] = JSON.parse(values.questionIds || '[]');
  const options = (values.options || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <Modal
      title={`${values.id ? 'Edit' : 'Add'} ${kind === 'questions' ? 'question' : kind === 'campuses' ? 'campus' : kind === 'assessments' ? 'assessment' : 'contest'}`}
      onClose={onClose}
    >
      <form
        className="form-stack admin-editor"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(values, kind);
        }}
      >
        {kind === 'questions' ? (
          <>
            {field('prompt', 'Question', 'textarea')}
            {field('topic', 'Topic')}
            {field('options', 'Answer options — one per line', 'textarea')}
            <FormField label="Correct answer">
              <select value={values.answer} onChange={(e) => update('answer', e.target.value)}>
                {options.map((o, i) => (
                  <option key={i} value={i}>
                    {String.fromCharCode(65 + i)}. {o}
                  </option>
                ))}
              </select>
            </FormField>
          </>
        ) : (
          <>
            {field('name', 'Name')}
            {kind === 'campuses' ? (
              <>
                {field('location', 'Location')}
                {field('courses', 'Courses — separated by commas')}
                {field('branches', 'Branches — separated by commas')}
                {field('studentPool', 'Student pool', 'number')}
              </>
            ) : (
              <>
                <div className="admin-editor-grid">
                  {field('duration', 'Duration in minutes', 'number')}
                  {select('status', 'Visibility', ['draft', 'published', 'archived'])}
                </div>
                <FormField label="Audience">
                  <select
                    value={values.campusId}
                    onChange={(e) => update('campusId', e.target.value)}
                  >
                    <option value="">All campuses</option>
                    {data.campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                {kind === 'contests' ? (
                  <>
                    {field('type', 'Contest category')}
                    <div className="admin-editor-grid">
                      {field('points', 'Reward XP', 'number')}
                      {select('difficulty', 'Difficulty', ['Easy', 'Medium', 'Hard'])}
                    </div>
                    {field('prompt', 'Challenge prompt', 'textarea')}
                    {field('answer', 'Expected short answer')}
                    <p className="muted">
                      Answers are compared without case sensitivity. This supports short-answer
                      challenges, not code execution.
                    </p>
                  </>
                ) : (
                  <>
                    {select('type', 'Assessment type', [
                      'Skill',
                      'Aptitude',
                      'Technical',
                      'Communication',
                    ])}
                    {field('skill', 'Skill to verify (optional)', 'text', true)}
                    <fieldset className="admin-question-picker">
                      <legend>Choose questions ({selected.length} selected)</legend>
                      {data.questions.length ? (
                        data.questions.map((q) => (
                          <label key={q.id}>
                            <input
                              type="checkbox"
                              checked={selected.includes(q.id)}
                              onChange={(e) =>
                                update(
                                  'questionIds',
                                  JSON.stringify(
                                    e.target.checked
                                      ? [...selected, q.id]
                                      : selected.filter((id) => id !== q.id),
                                  ),
                                )
                              }
                            />
                            <span>
                              {q.prompt}
                              <small>{q.topic}</small>
                            </span>
                          </label>
                        ))
                      ) : (
                        <p>Add questions to the question bank first.</p>
                      )}
                    </fieldset>
                  </>
                )}
                <p className="muted">
                  Drafts and archived items stay hidden from students. Published items appear in the
                  selected audience’s dashboard.
                </p>
              </>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
          <ShieldCheck size={16} />
        </Button>
      </form>
    </Modal>
  );
}
