'use client';
import { AnalysisSource } from '@/components/external-analysis-setting';
import {
  Badge,
  Button,
  EmptyState,
  FormField,
  Modal,
  PageHeader,
  Progress,
  formatDate,
} from '@/components/ui';
import { interviewService } from '@/services/platform.service';
import { WorkspaceData, Role } from '@/types';
import type { MlAnnotation } from '@/types/ml';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock,
  Mic,
  Plus,
  Send,
  Sparkles,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
type Props = {
  data: WorkspaceData;
  role: Role;
  id?: string;
  refresh: () => void;
  notify: (s: string) => void;
};
export function InterviewsPage({
  data,
  role,
  id,
  refresh,
  notify,
  practiceOnly = false,
}: Props & {
  practiceOnly?: boolean;
}) {
  const [tab, setTab] = useState(practiceOnly || id === 'mock' ? 'Mock interviews' : 'Upcoming');
  const [schedule, setSchedule] = useState(id === 'create');
  const [error, setError] = useState('');
  const item = data.interviews.find((i) => i.id === id);
  return (
    <>
      <PageHeader
        eyebrow="A CONVERSATION CAN CHANGE EVERYTHING"
        title={item ? `${item.company} · ${item.round}` : 'Walk in a little more ready.'}
        description="Real interviews take place during physical campus drives. Practice interviews are preparation tools."
        action={
          role !== 'student' &&
          !practiceOnly && (
            <Button onClick={() => setSchedule(true)}>
              <Plus size={16} /> Schedule interview
            </Button>
          )
        }
      />
      {item ? (
        <section className="panel lavender">
          <Badge>{item.status}</Badge>
          <h2>{item.role}</h2>
          <div className="detail-list">
            <span>
              Company<b>{item.company}</b>
            </span>
            <span>
              Date<b>{formatDate(item.date)}</b>
            </span>
            <span>
              Time<b>{item.time} IST</b>
            </span>
            <span>
              Format<b>{item.mode}</b>
            </span>
            <span>
              Round<b>{item.round}</b>
            </span>
          </div>
          <p>
            Bring your latest resume, review the role requirements, and be ready to explain a
            project you’re proud of.
          </p>
          <Link className="button dark" href="/student/interviews/ai">
            Prepare with a mock interview <ArrowUpRight size={16} />
          </Link>
        </section>
      ) : (
        <>
          <div className="tabs">
            {(practiceOnly
              ? ['Mock interviews']
              : ['Upcoming', 'Mock interviews', 'Interview history']
            ).map((t) => (
              <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
          {tab === 'Upcoming' ? (
            <div className="three-columns">
              {data.interviews.map((i, n) => (
                <section
                  key={i.id}
                  className={`panel interview-card ${n % 2 ? 'pink' : 'lavender'}`}
                >
                  <div className="panel-header">
                    <Badge>{i.status}</Badge>
                    <Video size={22} />
                  </div>
                  <h3>{i.company}</h3>
                  <p>
                    {i.role} · {i.round}
                  </p>
                  <div className="interview-meta">
                    <span>
                      <CalendarDays size={16} />
                      {formatDate(i.date)}
                    </span>
                    <span>
                      <Clock size={16} />
                      {i.time} IST · {i.mode}
                    </span>
                  </div>
                  <Link href={`/${role}/interviews/${i.id}`} className="button outline">
                    View details <ArrowUpRight size={15} />
                  </Link>
                </section>
              ))}
            </div>
          ) : tab === 'Mock interviews' ? (
            <>
              <InterviewTemplates data={data} role={role} refresh={refresh} notify={notify} />
              <div className="three-columns">
                {[
                  'Frontend Developer Practice',
                  'Backend Developer Mock',
                  'Behavioral Interview Prep',
                ].map((t, n) => (
                  <section className={`panel ${['yellow', 'blue', 'sage'][n]}`} key={t}>
                    <Badge>Platform practice</Badge>
                    <h3>{t}</h3>
                    <p>
                      Technical fundamentals, projects, and communication. Intermediate · 25
                      minutes.
                    </p>
                    <Link className="button dark" href="/student/interviews/ai">
                      Start practice <ArrowUpRight size={16} />
                    </Link>
                  </section>
                ))}
              </div>
            </>
          ) : (
            <div className="panel">
              {data.history
                .filter((h) => h.type === 'Interview')
                .map((h) => (
                  <div className="history-row" key={h.id}>
                    <b>{h.name}</b>
                    <span>{h.score}%</span>
                    <Badge>+{h.points} XP</Badge>
                    <span>{formatDate(h.date)}</span>
                  </div>
                ))}
              {!data.history.some((h) => h.type === 'Interview') && (
                <EmptyState
                  title="Every conversation is practice."
                  description="Complete a mock interview to start your history."
                />
              )}
            </div>
          )}
          {role === 'student' && (
            <Link href="/student/communication" className="communication-dashboard-link">
              <span className="communication-icon">
                <Mic size={23} />
              </span>
              <div>
                <strong>Practice your communication with your voice.</strong>
                <p>Speak, review your transcript, and learn how to improve your answer.</p>
              </div>
              <span>
                Start speaking <ArrowUpRight size={16} />
              </span>
            </Link>
          )}
          {role === 'student' && (
            <section className="panel ai-practice-banner yellow">
              <span className="ai-icon">
                <Sparkles size={30} />
              </span>
              <div>
                <Badge>INTERVIEW PRACTICE</Badge>
                <h2>A safe space to find your voice.</h2>
                <p>
                  Answer preparation questions and review feedback before the real conversation.
                </p>
              </div>
              <Link href="/student/interviews/ai" className="button dark">
                Try interview practice <ArrowUpRight size={17} />
              </Link>
            </section>
          )}
        </>
      )}
      {schedule && (
        <Modal title="Make room for a conversation." onClose={() => setSchedule(false)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await interviewService.schedule({
                  company: String(f.get('company')),
                  role: String(f.get('role')),
                  date: String(f.get('date')),
                  time: String(f.get('time')),
                  mode: String(f.get('mode')),
                  round: String(f.get('round')),
                });
                refresh();
                setSchedule(false);
                notify('Interview scheduled.');
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <div className="form-row">
              <FormField label="Company">
                <input name="company" required />
              </FormField>
              <FormField label="Role">
                <input name="role" required placeholder="Frontend Engineer" />
              </FormField>
            </div>
            <div className="form-row">
              <FormField label="Date">
                <input name="date" type="date" required />
              </FormField>
              <FormField label="Time (IST)">
                <input name="time" type="time" required />
              </FormField>
            </div>
            <FormField label="Round">
              <select name="round">
                <option>Technical interview</option>
                <option>HR interview</option>
                <option>Mock interview</option>
                <option>Portfolio discussion</option>
              </select>
            </FormField>
            <FormField label="Mode">
              <select name="mode">
                <option>On campus · Placement Block</option>
                <option>On campus</option>
              </select>
            </FormField>
            {error && <p className="field-error">{error}</p>}
            <Button type="submit">
              Schedule interview <Check size={16} />
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function AIInterview({
  refresh,
  notify,
}: {
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [role, setRole] = useState('Frontend Developer');
  const [type, setType] = useState('Mixed');
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [template, setTemplate] = useState<string | undefined>();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setTemplate(new URLSearchParams(window.location.search).get('template') || undefined);
  }, []);
  const { data } = useQuery({
    queryKey: ['ai-interview', template, role, type, difficulty],
    queryFn: () => interviewService.startAIInterview(template, role, type, difficulty),
  });
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [practiceError, setPracticeError] = useState('');
  const { data: feedback } = useQuery<
    Awaited<ReturnType<typeof interviewService.getInterviewFeedback>> & MlAnnotation
  >({
    queryKey: ['interview-feedback', done],
    queryFn: interviewService.getInterviewFeedback,
    enabled: done,
  });
  useEffect(() => {
    if (!started || done) return;
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [started, done]);
  return (
    <>
      <PageHeader
        eyebrow="PRACTICE WITHOUT THE PRESSURE"
        title="Find your interview voice."
        description={
          'Practice with role-specific questions and get feedback on your written answers.'
        }
        action={<Badge>{'Interview preparation'}</Badge>}
      />
      {done ? (
        <div className="panel interview-result">
          <span className="result-symbol sage">
            <Check size={42} />
          </span>
          <h2>One conversation closer.</h2>
          <p>Your practice is recorded. +75 XP for showing up and putting in the work.</p>
          <Badge>{feedback?.label || 'Preparing feedback'}</Badge>
          <div className="topic-results">
            {feedback?.categories.map((c) => (
              <div key={c.name}>
                <span>{c.name}</span>
                <Progress value={c.score} />
                <b>{c.score}%</b>
              </div>
            ))}
          </div>
          <p>{feedback?.advice}</p>
          {feedback?.ml && <AnalysisSource status={feedback.ml.status} />}
          <p className="muted">
            {
              'Feedback uses your submitted answers and supports preparation; it is not a validated hiring assessment.'
            }
          </p>
          <Link href="/student/interviews" className="button dark">
            Back to interview hub <ArrowUpRight size={16} />
          </Link>
        </div>
      ) : !started ? (
        <section className="panel lavender interview-setup">
          <Sparkles size={40} />
          <h2>
            Take a breath.
            <br />
            Let’s practice.
          </h2>
          <div className="form-stack">
            <FormField label="Target role">
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option>Frontend Developer</option>
                <option>Backend Developer</option>
                <option>Data Analyst</option>
              </select>
            </FormField>
            <div className="form-row">
              <FormField label="Difficulty">
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option>Intermediate</option>
                  <option>Beginner</option>
                  <option>Advanced</option>
                </select>
              </FormField>
              <FormField label="Interview type">
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option>Mixed</option>
                  <option>Technical</option>
                  <option>HR</option>
                  <option>Behavioral</option>
                </select>
              </FormField>
            </div>
            <p>
              {data?.questions.length || 3} practice questions. Text responses. Microphone is a
              future integration.
            </p>
            <Button disabled={!data} onClick={() => setStarted(true)}>
              Start practice <ArrowRightIcon />
            </Button>
          </div>
        </section>
      ) : (
        <div className="two-columns">
          <section className="panel interviewer-panel lavender">
            <div className="interviewer-avatar">
              <Sparkles size={54} />
            </div>
            <Badge>Practice questions</Badge>
            <h2>
              A little preparation.
              <br />A lot more confidence.
            </h2>
            <p>
              {role} · Question {index + 1} of {data?.questions.length || 3}
            </p>
            <div className="sound-wave">▂ ▅ ▃ ▇ ▅ ▂ ▄ ▆ ▃</div>
          </section>
          <form
            className="panel form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setAnswers((a) => [...a, answer]);
              if (index < (data?.questions.length || 3) - 1) {
                setIndex((i) => i + 1);
                setAnswer('');
              } else {
                setBusy(true);
                try {
                  await interviewService.completePractice([...answers, answer], elapsed);
                  refresh();
                  notify('Practice complete! +75 XP');
                  setDone(true);
                } catch (e) {
                  setPracticeError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }
            }}
          >
            <div className="panel-header">
              <Badge>
                QUESTION {index + 1} / {data?.questions.length || 3}
              </Badge>
              <Badge>
                <Clock size={13} />
                {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} elapsed
              </Badge>
            </div>
            <h2>{data?.questions[index]}</h2>
            <FormField label="Your response">
              <textarea
                rows={8}
                required
                minLength={20}
                placeholder="Explain your thinking with a specific example…"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
            </FormField>
            <span className="muted">
              <Mic size={15} /> Written-answer practice
            </span>
            <Button type="submit" disabled={busy}>
              {index === (data?.questions.length || 3) - 1 ? 'Finish practice' : 'Next question'}{' '}
              <Send size={16} />
            </Button>
            {practiceError && (
              <p role="alert" className="field-error">
                {practiceError}
              </p>
            )}
          </form>
        </div>
      )}
    </>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={16} />;
}
function InterviewTemplates({
  data,
  role,
  refresh,
  notify,
}: {
  data: WorkspaceData;
  role: Role;
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  return (
    <section className="template-section">
      <div className="section-header">
        <div>
          <h2>Practice with a team’s perspective.</h2>
          <p>Role-specific interview templates created by recruiters.</p>
        </div>
        {role === 'recruiter' && (
          <Button kind="outline" onClick={() => setOpen(true)}>
            <Plus size={15} /> Create template
          </Button>
        )}
      </div>
      {data.interviewTemplates?.map((t) => (
        <div className="panel template-card" key={t.id}>
          <Badge>Recruiter-created · {t.audience}</Badge>
          <h3>{t.name}</h3>
          <p>
            {t.targetRole} · {t.difficulty} · {t.duration} min
          </p>
          <div className="job-chips">
            {t.skills.split(',').map((s) => (
              <Badge key={s}>{s.trim()}</Badge>
            ))}
          </div>
          <details>
            <summary>Preview interview questions</summary>
            <ol>
              {t.questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </details>
          {role === 'student' && (
            <Link href={`/student/interviews/ai?template=${t.id}`} className="text-link">
              Practice this interview <ArrowUpRight size={15} />
            </Link>
          )}
        </div>
      ))}
      {open && (
        <Modal title="Create a mock interview template" onClose={() => setOpen(false)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const questions = String(f.get('questions'))
                .split('\n')
                .map((q) => q.trim())
                .filter(Boolean);
              if (questions.length < 3) {
                setError('Add at least three questions, one per line.');
                return;
              }
              await interviewService.createTemplate({
                name: String(f.get('name')),
                targetRole: String(f.get('role')),
                difficulty: String(f.get('difficulty')),
                duration: Number(f.get('duration')),
                skills: String(f.get('skills')),
                topics: String(f.get('topics')),
                questions,
                audience: String(f.get('audience')),
              });
              refresh();
              setOpen(false);
              notify('Interview template published.');
            }}
          >
            <FormField label="Mock interview name">
              <input required name="name" placeholder="Backend Developer Mock" />
            </FormField>
            <FormField label="Target role">
              <input required name="role" placeholder="Backend Developer" />
            </FormField>
            <div className="form-row">
              <FormField label="Difficulty">
                <select name="difficulty">
                  <option>Intermediate</option>
                  <option>Beginner</option>
                  <option>Advanced</option>
                </select>
              </FormField>
              <FormField label="Duration (minutes)">
                <input required name="duration" type="number" min={5} max={120} defaultValue={25} />
              </FormField>
            </div>
            <FormField label="Skills">
              <input required name="skills" placeholder="Node.js, SQL, System Design" />
            </FormField>
            <FormField label="Topics">
              <input required name="topics" placeholder="APIs, databases, scalability" />
            </FormField>
            <FormField label="Manual questions (one per line)">
              <textarea
                name="questions"
                required
                rows={5}
                placeholder={
                  'Tell me about a project you built.\nHow would you design a REST API?\nHow do you optimize a slow database query?'
                }
              />
            </FormField>
            <FormField label="Publish to">
              <select name="audience">
                <option>Applicants</option>
                <option>Shortlisted candidates</option>
                <option>All eligible students</option>
              </select>
            </FormField>
            <p className="muted">
              Manual questions are used in this preview. Future question generation connects through
              a backend service.
            </p>
            {error && <p className="field-error">{error}</p>}
            <Button type="submit">
              Publish template <Check size={16} />
            </Button>
          </form>
        </Modal>
      )}
    </section>
  );
}
