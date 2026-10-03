'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession, authService } from '@/store/session';
import { apiClient } from '@/services/api/client';
import { backendEnabled, rpc, setTargetStudent } from '@/services/api/remote';
import { recruiterService } from '@/services/platform.service';
import { Badge, Button, FormField } from './ui';
import type { Role, User } from '@/types';
export function BackendTools({ role }: { role: Role }) {
  if (!backendEnabled) return null;
  return <ConnectedTools role={role} />;
}
function ConnectedTools({ role }: { role: Role }) {
  const user = useSession((s) => s.user),
    client = useQueryClient(),
    [selected, setSelected] = useState(''),
    [message, setMessage] = useState('');
  const { data: people } = useQuery({
    queryKey: ['authorized-students', user?.id],
    queryFn: recruiterService.getCandidates,
    enabled: role !== 'student' && Boolean(user?.approved),
  });
  const { data: consent } = useQuery({
    queryKey: ['ai-consent', user?.id],
    queryFn: async () => (await apiClient.get('/account/ai-consent')).data,
    enabled: Boolean(user),
  });
  const { data: approvals } = useQuery<User[]>({
    queryKey: ['account-approvals', user?.id],
    queryFn: async () => (await apiClient.get('/approvals')).data,
    enabled: role === 'campus' && Boolean(user?.approved),
  });
  if (
    role === 'student' &&
    user?.approved &&
    user.verified &&
    consent?.provider !== 'openai' &&
    !consent?.mlConfigured &&
    !message
  )
    return null;
  return (
    <section className="panel backend-tools" style={{ marginBottom: 20 }}>
      {!user?.approved && (
        <p role="status">
          Your organization account is awaiting approval. An authorized campus team or project
          operator must approve it.
        </p>
      )}
      {user && !user.verified && (
        <p>
          Email verification is pending.{' '}
          <button
            className="text-button"
            onClick={async () => {
              try {
                await authService.restore();
                await apiClient.post('/auth/resend-verification');
                setMessage('Verification email queued.');
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Send verification email
          </button>
        </p>
      )}
      {role !== 'student' && (
        <FormField label="Student record for applications, offers, interviews and documents">
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setTargetStudent(e.target.value);
              client.removeQueries({ queryKey: ['platform'] });
              void client.invalidateQueries();
            }}
          >
            <option value="">
              {people?.length ? 'First authorized student' : 'No authorized students yet'}
            </option>
            {people?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.email}
              </option>
            ))}
          </select>
        </FormField>
      )}
      {role === 'student' && consent?.provider === 'openai' && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={Boolean(consent.consent)}
            onChange={async (e) => {
              try {
                await rpc('studentService', 'getDashboard');
                await apiClient.put('/account/ai-consent', { consent: e.target.checked });
                void client.invalidateQueries({ queryKey: ['ai-consent'] });
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          />{' '}
          Allow my resume text and practice answers to be sent to OpenAI for optional coaching.
          Local analysis works without this.
        </label>
      )}
      {role === 'student' && consent?.mlConfigured && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={Boolean(consent.mlConsent)}
            onChange={async (e) => {
              try {
                await authService.restore();
                await apiClient.put('/account/ml-consent', { consent: e.target.checked });
                void client.invalidateQueries({ queryKey: ['ai-consent'] });
                client.removeQueries({ queryKey: ['match'] });
                client.removeQueries({ queryKey: ['outcome-insight'] });
                setMessage(
                  e.target.checked
                    ? 'External ML analysis enabled.'
                    : 'External ML analysis disabled. Local analysis remains available.',
                );
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          />{' '}
          Allow my redacted resume text, skills and project summaries, preparation scores, and
          practice answers to be sent to campuslink-ml-demo.onrender.com for optional analysis.
          Emails and phone numbers are removed from text; other identifying details may remain. I
          can turn this off at any time to stop future requests. Local analysis works without this.
        </label>
      )}
      {approvals?.length ? (
        <details>
          <summary>Recruiter accounts awaiting review ({approvals.length})</summary>
          {approvals.map((a) => (
            <p key={a.id}>
              {a.name} · {a.email}{' '}
              <Button
                kind="outline"
                onClick={async () => {
                  try {
                    await rpc('studentService', 'getDashboard');
                    await apiClient.post(`/approvals/${a.id}`, { approved: true });
                    void client.invalidateQueries({ queryKey: ['account-approvals'] });
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                Approve organization
              </Button>
            </p>
          ))}
        </details>
      ) : null}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
interface Analytics {
  registered: number;
  ready: number;
  placed: number;
  offers: number;
  accepted: number;
  pending: number;
  joined: number;
  active: number;
  average: number;
  highest: number;
  branches: { name: string; total: number; placed: number; conversion: number }[];
  skills: { name: string; total: number; placed: number; conversion: number }[];
  support: { id: string; name: string; score: number; factors: string[] }[];
  recruiters: { name: string; drives: number; repeatHiring: boolean }[];
  documents: { total: number; verified: number };
}
export function ConnectedAnalytics() {
  const { data, error, isLoading } = useQuery<Analytics>({
    queryKey: ['server-analytics'],
    queryFn: async () => (await apiClient.get('/analytics')).data,
    refetchInterval: 15000,
  });
  if (isLoading) return <p>Loading placement records…</p>;
  if (error || !data) return <p role="alert">{error?.message || 'Analytics unavailable.'}</p>;
  const metrics = [
    ['Registered students', data.registered],
    ['Placement ready', data.ready],
    ['Placed students', data.placed],
    ['Active drives', data.active],
    ['Offers', data.offers],
    ['Accepted', data.accepted],
    ['Pending', data.pending],
    ['Joined', data.joined],
    ['Average CTC (LPA)', data.average],
    ['Highest CTC (LPA)', data.highest],
  ] as const;
  return (
    <>
      <div className="section-header">
        <div>
          <h1>Your placement command centre.</h1>
          <p>Campus-scoped records · refreshed every 15 seconds</p>
        </div>
        <Button
          kind="outline"
          onClick={() => {
            const csv = [['Metric', 'Value'], ...metrics].map((row) => row.join(',')).join('\n'),
              url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
              a = document.createElement('a');
            a.href = url;
            a.download = 'campuslink-placement-report.csv';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export report
        </Button>
      </div>
      <div className="metrics-grid">
        {metrics.map(([name, value], i) => (
          <div
            key={name}
            className={`metric-card ${['lavender', 'sage', 'yellow', 'pink'][i % 4]}`}
          >
            <span>{name}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>
      <div className="two-columns">
        {(['branches', 'skills'] as const).map((key) => (
          <section className="panel" key={key}>
            <h2>{key === 'branches' ? 'Branch conversion' : 'Skill conversion'}</h2>
            {data[key].map((row) => (
              <p key={row.name}>
                <b>{row.name}</b> · {row.placed}/{row.total} placed · {row.conversion}%
              </p>
            ))}
            <small>Observed outcomes do not establish a causal effect.</small>
          </section>
        ))}
      </div>
      <section className="panel">
        <h2>Students who may need preparation support</h2>
        {data.support.map((s) => (
          <p key={s.id}>
            <b>{s.name}</b> · Readiness {s.score}/100
            <br />
            {s.factors.join(' · ')}
          </p>
        ))}
        {!data.support.length && <p>No current preparation support flags.</p>}
      </section>
      <div className="two-columns">
        <section className="panel">
          <h2>Recruiter engagement</h2>
          {data.recruiters.map((r) => (
            <p key={r.name}>
              {r.name} · {r.drives} drives{' '}
              <Badge>{r.repeatHiring ? 'Repeat hiring' : 'First cycle'}</Badge>
            </p>
          ))}
        </section>
        <section className="panel">
          <h2>Document verification</h2>
          <p>
            {data.documents.verified} verified of {data.documents.total} submitted
          </p>
        </section>
      </div>
    </>
  );
}
export function AuthLinkPage({ verify = false }: { verify?: boolean }) {
  const [password, setPassword] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <div className="content-width" style={{ maxWidth: 560, padding: '80px 20px' }}>
      <h1>{verify ? 'Verify your email' : 'Reset your password'}</h1>
      <form
        method="post"
        className="panel form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const token = new URLSearchParams(window.location.search).get('token');
            const { data } = await apiClient.post(
              verify ? '/auth/verify-email' : '/auth/reset-password',
              { token, ...(!verify ? { password } : {}) },
            );
            setMessage(data.message);
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {!verify && (
          <FormField label="New password">
            <input
              type="password"
              minLength={10}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </FormField>
        )}
        <Button type="submit" disabled={busy}>
          {verify ? 'Verify email' : 'Save new password'}
        </Button>
        <p role="status">{message}</p>
        <Link href="/login">Back to sign in</Link>
      </form>
    </div>
  );
}
export function CareerIntelligence({ studentId }: { studentId: string }) {
  const [question, setQuestion] = useState(''),
    [answer, setAnswer] = useState(''),
    [error, setError] = useState('');
  const { data } = useQuery<{
    label: string;
    risk: string;
    factors: string[];
    ml?: { status: string; message: string };
    model: {
      available: boolean;
      label: string;
      probability?: number;
      reason?: string;
      provenance?: string;
      limitations?: string[];
    };
  }>({
    queryKey: ['outcome-insight', studentId],
    queryFn: () => rpc('aiService', 'predictPlacementRisk', [studentId]),
  });
  return (
    <div className="two-columns">
      <section className="panel">
        <h2>Preparation support</h2>
        <Badge>{data?.label || 'Loading evidence'}</Badge>
        <p>{data?.risk} support priority</p>
        {data?.factors.map((f) => (
          <p key={f}>{f}</p>
        ))}
        <h3>{data?.model.label}</h3>
        {data?.ml && (
          <p className="muted" role="status">
            {data.ml.message}
          </p>
        )}
        {data?.model.available ? (
          <p>
            {data.model.provenance === 'synthetic'
              ? 'Synthetic demonstration estimate'
              : 'Historical model estimate'}
            : {data.model.probability}%. This is not a placement guarantee.
          </p>
        ) : (
          <p>{data?.model.reason}</p>
        )}
        {data?.model.provenance === 'historical' && (
          <p className="muted">
            This estimate uses current preparation scores. Confirm that their scoring rubrics match
            the historical training data before interpreting the probability.
          </p>
        )}
        {data?.model.limitations?.map((limitation) => (
          <p key={limitation} className="muted">
            {limitation}
          </p>
        ))}
      </section>
      <section className="panel sage">
        <h2>Ask your placement assistant</h2>
        <p>Answers use your placement records.</p>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await rpc('studentService', 'getDashboard');
              const { data } = await apiClient.post('/assistant', { question });
              setAnswer(data.answer);
              setError('');
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <FormField label="Your question">
            <input
              required
              minLength={3}
              maxLength={1000}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Which drives am I eligible for?"
            />
          </FormField>
          <Button type="submit">Ask</Button>
        </form>
        <p style={{ whiteSpace: 'pre-line' }}>{answer}</p>
        {error && <p role="alert">{error}</p>}
      </section>
    </div>
  );
}
export function ConnectedCompany() {
  const client = useQueryClient(),
    [message, setMessage] = useState('');
  const { data } = useQuery<{
    name: string;
    description: string;
    industry: string;
    headquarters: string;
  }>({
    queryKey: ['organization'],
    queryFn: async () => (await apiClient.get('/organization')).data,
  });
  if (!data) return <p>Loading your company profile…</p>;
  return (
    <section className="panel">
      <h1>Your company profile</h1>
      <form
        className="form-stack"
        key={JSON.stringify(data)}
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await authService.restore();
            const form = new FormData(e.currentTarget);
            await apiClient.put(
              '/organization',
              Object.fromEntries(
                ['name', 'description', 'industry', 'headquarters'].map((k) => [
                  k,
                  String(form.get(k)),
                ]),
              ),
            );
            void client.invalidateQueries({ queryKey: ['organization'] });
            setMessage('Company profile saved.');
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        {(['name', 'industry', 'headquarters'] as const).map((k) => (
          <FormField key={k} label={k}>
            <input name={k} defaultValue={data[k]} required={k === 'name'} maxLength={150} />
          </FormField>
        ))}
        <FormField label="About your company">
          <textarea name="description" defaultValue={data.description} maxLength={5000} rows={5} />
        </FormField>
        <Button type="submit">Save profile</Button>
        <p role="status">{message}</p>
      </form>
    </section>
  );
}
