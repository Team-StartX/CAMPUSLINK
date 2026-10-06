'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Clock,
  Trophy,
  CircleCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { assessmentService, contestService } from '@/services/platform.service';
import { AssessmentAttempt, DemoData, Role } from '@/types';
import { Button, PageHeader, Progress, Badge, EmptyState, formatDate } from '@/components/ui';
import { ContestProgress } from '@/components/contest-progress';
import { contestAchievements } from '@/utils/contest-achievements';
export function AssessmentsPage({ data, role = 'student' }: { data: DemoData; role?: Role }) {
  const [tab, setTab] = useState('Available');
  const [filter, setFilter] = useState('All');
  return (
    <>
      <PageHeader
        eyebrow="BUILD CONFIDENCE, ONE ASSESSMENT AT A TIME"
        title="Prove what you know."
        description="One place for every assessment, every result, and every step forward."
      />
      <div className="tabs">
        {['Available', 'Assessment history'].map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
            {t === 'Assessment history' && ` (${data.history.length})`}
          </button>
        ))}
      </div>
      <div className="filter-pills">
        {['All', 'Skill', 'Aptitude', 'Technical', 'Coding', 'Interview', 'Recruiter'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={filter === f ? 'selected' : ''}>
            {f}
          </button>
        ))}
      </div>
      {tab === 'Available' ? (
        <div className="three-columns">
          {data.assessments
            .filter((a) => filter === 'All' || a.type === filter)
            .map((a) => (
              <div className={`assessment-card panel ${a.color}`} key={a.id}>
                <div className="panel-header">
                  <Badge>{a.type}</Badge>
                  <span>↗</span>
                </div>
                <h3>{a.name}</h3>
                <p>Show your understanding with 10 thoughtfully selected questions.</p>
                <div className="assessment-meta">
                  <Clock size={15} />
                  {a.duration} min · {a.questionCount || 10} questions
                </div>
                <Link className="button dark" href={`/${role}/assessments/${a.id}`}>
                  Start assessment <ArrowUpRight size={16} />
                </Link>
              </div>
            ))}
        </div>
      ) : (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Assessment</th>
                <th>Score</th>
                <th>Points</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.history
                .filter((h) => filter === 'All' || h.type === filter)
                .map((h) => (
                  <tr key={h.id}>
                    <td>
                      <b>{h.name}</b>
                      <small>{h.type}</small>
                    </td>
                    <td>{h.score}%</td>
                    <td>+{h.points} XP</td>
                    <td>{formatDate(h.date)}</td>
                    <td>
                      <Badge kind={h.score >= 70 ? 'verified' : ''}>
                        {h.score >= 70 ? 'Passed' : 'Keep practicing'}
                      </Badge>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {data.history.filter((h) => filter === 'All' || h.type === filter).length === 0 && (
            <EmptyState
              title="A fresh start."
              description="Complete an assessment to see your progress here."
            />
          )}
        </div>
      )}
    </>
  );
}
export function AssessmentSession({
  id,
  onComplete,
  role = 'student',
}: {
  id: string;
  onComplete: () => void;
  role?: Role;
}) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['assessment', id],
    queryFn: () => assessmentService.startAssessment(id),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity,
    retry: false,
  });
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>(Array(10).fill(-1));
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<AssessmentAttempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (data && !started) setAnswers(Array(data.questions.length).fill(-1));
  }, [data, started]);
  useEffect(() => {
    if (!started || result) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [started, result]);
  const finish = useCallback(
    async (timed = false) => {
      if (!timed && answers.includes(-1)) {
        setMessage('Answer every question before submitting.');
        return;
      }
      if (busy || result) return;
      setBusy(true);
      try {
        const r = await assessmentService.submitAssessment(id, answers, seconds);
        setResult(r);
        onComplete();
      } catch (e) {
        setMessage((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [answers, busy, id, onComplete, result, seconds],
  );
  useEffect(() => {
    if (started && !result && seconds >= (data?.assessment.duration || 10) * 60) void finish(true);
  }, [seconds, started, result, finish, data?.assessment.duration]);
  if (isLoading) return <div className="skeleton panel">Loading your assessment…</div>;
  if (error || !data)
    return (
      <EmptyState
        title="Assessment not found"
        action={<Link href="/student/assessments">Back to assessments</Link>}
      />
    );
  const { assessment, questions } = data;
  const q = questions[index];
  if (result)
    return (
      <div className="assessment-result panel">
        <div className={`result-symbol ${result.score >= 70 ? 'sage' : 'yellow'}`}>
          <Trophy size={42} />
        </div>
        <Badge>{result.score >= 70 ? 'WELL DONE!' : 'EVERY ATTEMPT IS PROGRESS'}</Badge>
        <h1>{result.score >= 70 ? 'Potential, proven.' : 'Keep the momentum.'}</h1>
        <p>{assessment.name}</p>
        <div className="result-score">
          {result.score}
          <span>%</span>
        </div>
        <div className="result-stats">
          <span>
            Accuracy <b>{result.score}%</b>
          </span>
          <span>
            Time{' '}
            <b>
              {Math.floor(result.seconds / 60)}m {result.seconds % 60}s
            </b>
          </span>
          <span>
            Career points <b>+{result.points} XP</b>
          </span>
        </div>
        <Badge kind={result.score >= 70 ? 'verified' : ''}>
          {result.score >= 70 && assessment.skill
            ? `${assessment.skill} · VERIFIED`
            : result.score >= 70
              ? 'Assessment passed'
              : 'Try again after some practice'}
        </Badge>
        <div className="topic-results">
          {Array.from(new Set(questions.map((q) => q.topic))).map((topic) => {
            const grouped = questions
              .map((q, i) => ({ ...q, index: i }))
              .filter((q) => q.topic === topic);
            const score =
              result.topicScores?.[topic] ??
              Math.round(
                (grouped.filter((q) => answers[q.index] === q.answer).length / grouped.length) *
                  100,
              );
            return (
              <div key={topic}>
                <span>{topic}</span>
                <Progress value={score} />
                <b>{score}%</b>
              </div>
            );
          })}
        </div>
        <div className="hero-buttons">
          <Link className="button dark" href={`/${role}/dashboard`}>
            Back to my journey <ArrowUpRight size={16} />
          </Link>
          <Link className="button outline" href={`/${role}/assessments`}>
            Assessment history
          </Link>
        </div>
      </div>
    );
  if (!started)
    return (
      <>
        <PageHeader
          title={assessment.name}
          description="Take a breath. You’ve been building toward this."
        />
        <div className="assessment-intro panel lavender">
          <div className="result-symbol">
            <CircleCheck size={42} />
          </div>
          <h2>
            A little challenge.
            <br />A lot of confidence.
          </h2>
          <p>
            {questions.length} questions · {assessment.duration} minutes ·{' '}
            {assessment.skill ? '70% to verify your skill' : '70% to pass'}
          </p>
          <ul>
            <li>Select one answer for each question.</li>
            <li>You can move back and review your answers.</li>
            <li>Your score and points update your assessment history.</li>
            <li>
              The timer begins when you start. At {assessment.duration} minutes, your answers submit
              automatically.
            </li>
          </ul>
          {message && (
            <p className="field-error" role="alert">
              {message}
            </p>
          )}
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const attempt = await refetch({ throwOnError: true });
                setAnswers(Array(attempt.data!.questions.length).fill(-1));
                setSeconds(0);
                setStarted(true);
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Starting…' : 'I’m ready. Let’s begin.'} <ArrowRight size={17} />
          </Button>
        </div>
      </>
    );
  return (
    <>
      <PageHeader
        title={assessment.name}
        description="One question at a time. You’ve got this."
        action={
          <Badge>
            <Clock size={14} />
            {Math.floor(Math.max(0, assessment.duration * 60 - seconds) / 60)}:
            {String(Math.max(0, assessment.duration * 60 - seconds) % 60).padStart(2, '0')}{' '}
            remaining
          </Badge>
        }
      />
      <div className="quiz-layout">
        <div className="quiz panel">
          <div className="panel-header">
            <span className="eyebrow">
              QUESTION {index + 1} OF {questions.length}
            </span>
            <Badge>{q.topic}</Badge>
          </div>
          <Progress value={((index + 1) / questions.length) * 100} />
          <h2>{q.prompt}</h2>
          <div className="answer-options">
            {q.options.map((o, i) => (
              <button
                className={answers[index] === i ? 'selected' : ''}
                key={o}
                onClick={() => {
                  setAnswers((a) => a.map((v, n) => (n === index ? i : v)));
                  setMessage('');
                }}
              >
                <span>{String.fromCharCode(65 + i)}</span>
                {o}
                {answers[index] === i && <Check size={18} />}
              </button>
            ))}
          </div>
          {message && (
            <p role="alert" className="field-error">
              {message}
            </p>
          )}
          <div className="quiz-actions">
            <Button kind="outline" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              <ChevronLeft size={16} /> Previous
            </Button>
            {index < questions.length - 1 ? (
              <Button onClick={() => setIndex((i) => i + 1)}>
                Next question <ChevronRight size={16} />
              </Button>
            ) : (
              <Button disabled={busy} onClick={() => void finish()}>
                Finish assessment <Check size={16} />
              </Button>
            )}
          </div>
        </div>
        <aside className="panel question-map">
          <h3>Your progress</h3>
          <div>
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={i === index ? 'current' : answers[i] >= 0 ? 'answered' : ''}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p>
            {answers.filter((a) => a >= 0).length} of {questions.length} answered
          </p>
          <small>Take your time. Review your answers before submitting.</small>
        </aside>
      </div>
    </>
  );
}
export function ContestsPage({
  data,
  id,
  refresh,
  notify,
  role = 'student',
}: {
  data: DemoData;
  id?: string;
  refresh: () => void;
  notify: (s: string) => void;
  role?: Role;
}) {
  const { data: leaderboard } = useQuery({
    queryKey: ['leaderboard', data.student.xp],
    queryFn: contestService.getLeaderboard,
  });
  const [tab, setTab] = useState('Student leaderboard');
  const selected = data.contests.find((c) => c.id === id);
  const [participating, setParticipating] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [solved, setSolved] = useState(false);
  const join = async (contestId: string) => {
    await contestService.joinContest(contestId);
    refresh();
    notify('You’re registered. Let’s build some momentum.');
  };
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE FRIENDLY COMPETITION"
        title={selected?.name || 'Challenge yourself. Grow together.'}
        description="Build consistency, practice your skills, and celebrate every step forward."
      />
      {selected ? (
        <div className="panel lavender contest-detail">
          <Badge>
            {selected.type} · {selected.difficulty}
          </Badge>
          <h2>{selected.name}</h2>
          <p>
            {selected.duration} minutes · {selected.participants.toLocaleString()} participants · +
            {selected.points} XP on completion
          </p>
          <p>
            Demo contest: solve the practice challenge below. Your participation is recorded in
            assessment history.
          </p>
          {!selected.joined ? (
            <Button onClick={() => void join(selected.id)}>
              Register for contest <ArrowUpRight size={16} />
            </Button>
          ) : !participating ? (
            <Button disabled={selected.completed} onClick={() => setParticipating(true)}>
              {selected.completed ? 'Completed — points awarded' : 'Enter practice arena'}{' '}
              <ArrowRight size={16} />
            </Button>
          ) : (
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await contestService.submitContest(selected.id, answer);
                } catch (e) {
                  setError((e as Error).message);
                  return;
                }
                setSolved(true);
                refresh();
                notify(`Challenge completed! +${selected.points} XP`);
              }}
            >
              <h3>Challenge</h3>
              <p>{selected.prompt || 'Given 2, 4, 8, 16, what is the next number?'}</p>
              <label className="form-field">
                <span>Your answer</span>
                <input
                  required
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Enter your answer"
                />
              </label>
              {error && <p className="field-error">{error}</p>}
              <Button type="submit" disabled={solved || selected.completed}>
                {solved || selected.completed ? 'Completed — nicely done!' : 'Submit solution'}
              </Button>
            </form>
          )}
        </div>
      ) : (
        <div className="three-columns">
          {data.contests.map((c, i) => (
            <div key={c.id} className={`panel contest-card ${['yellow', 'lavender', 'pink'][i]}`}>
              <div className="panel-header">
                <Badge>{['Daily challenge', 'Weekly contest', 'Monthly challenge'][i]}</Badge>
                <Trophy size={22} />
              </div>
              <h3>{c.name}</h3>
              <p>
                {c.type} · {c.difficulty}
              </p>
              <div className="contest-meta">
                <span>
                  <Clock size={14} />
                  {c.duration} min
                </span>
                <span>{c.participants.toLocaleString()} participants</span>
                <b>+{c.points} XP</b>
              </div>
              <Link href={`/${role}/contests/${c.id}`} className="button dark">
                {c.completed ? 'View result' : c.joined ? 'Enter contest' : 'View challenge'}{' '}
                <ArrowUpRight size={15} />
              </Link>
            </div>
          ))}
        </div>
      )}
      {role === 'student' && <ContestProgress achievements={contestAchievements(data)} />}
      <div className="section-header">
        <div>
          <h2>Progress worth celebrating.</h2>
          <p>Points reflect activity and consistency, and are one part of your career story.</p>
        </div>
      </div>
      <div className="tabs">
        {['Student leaderboard', 'Campus leaderboard'].map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="panel leaderboard">
        {(tab === 'Student leaderboard'
          ? leaderboard?.map((p) => ({ name: p.name, xp: p.xp, sub: p.campus }))
          : [
              { name: 'Delhi Technological University', xp: 124800, sub: '1,248 active students' },
              { name: 'IIT Delhi', xp: 112400, sub: '982 active students' },
              { name: 'NSUT', xp: 98300, sub: '842 active students' },
            ]
        )?.map((p, i) => (
          <div key={p.name}>
            <span className={`rank ${i === 0 ? 'yellow' : ''}`}>{i + 1}</span>
            <span className="avatar-circle lavender">
              {p.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div>
              <b>{p.name}</b>
              <small>{p.sub}</small>
            </div>
            <strong>{p.xp.toLocaleString()} XP</strong>
            {i === 0 && <Trophy size={18} />}
          </div>
        ))}
      </div>
    </>
  );
}
