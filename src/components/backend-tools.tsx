'use client';
import { Loader } from '@/components/loader';
import { apiClient } from '@/services/api/client';
import { rpc, setTargetStudent } from '@/services/api/remote';
import { recruiterService } from '@/services/platform.service';
import { authService, useSession } from '@/store/session';
import type { Role, User } from '@/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { AnalysisSource, ExternalAnalysisSetting } from './external-analysis-setting';
import { OrganizationPicker } from './organization-picker';
import { PreparationOverview, type PreparationCategory } from './preparation-overview';
import { Badge, Button, FormField } from './ui';
export function BackendTools({ role }: { role: Role }) {
  return <ConnectedTools role={role} />;
}
function ConnectedTools({ role }: { role: Role }) {
  const user = useSession((s) => s.user),
    client = useQueryClient(),
    [selected, setSelected] = useState(''),
    [mlSaving, setMlSaving] = useState(false),
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
    consent?.provider !== 'openai' &&
    !consent?.mlConfigured &&
    !message
  )
    return null;
  return (
    <section
      className={`panel backend-tools ${role === 'student' ? 'student-backend-tools' : ''}`}
      style={{ marginBottom: 20 }}
    >
      {!user?.approved && (
        <p role="status">
          Your organization account is awaiting approval. An authorized campus team or project
          operator must approve it.
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
        <ExternalAnalysisSetting
          destination={consent.mlDestination}
          enabled={Boolean(consent.mlConsent)}
          busy={mlSaving}
          onChange={async (enabled) => {
            setMlSaving(true);
            try {
              await authService.restore();
              await apiClient.put('/account/ml-consent', { consent: enabled });
              client.setQueryData(
                ['ai-consent', user?.id],
                (old: Record<string, unknown> | undefined) => ({ ...old, mlConsent: enabled }),
              );
              await client.invalidateQueries({ queryKey: ['ai-consent'] });
              client.removeQueries({ queryKey: ['match'] });
              client.removeQueries({ queryKey: ['outcome-insight'] });
              setMessage('');
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setMlSaving(false);
            }
          }}
        />
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
  branches: {
    name: string;
    total: number;
    placed: number;
    conversion: number;
  }[];
  skills: {
    name: string;
    total: number;
    placed: number;
    conversion: number;
  }[];
  support: {
    id: string;
    name: string;
    score: number;
    factors: string[];
  }[];
  recruiters: {
    name: string;
    drives: number;
    repeatHiring: boolean;
    total: number;
    placed: number;
    conversion: number;
    average: number;
    highest: number;
  }[];
  documents: {
    total: number;
    verified: number;
  };
}
export function ConnectedAnalytics() {
  const { data, error, isLoading } = useQuery<Analytics>({
    queryKey: ['server-analytics'],
    queryFn: async () => (await apiClient.get('/analytics')).data,
    refetchInterval: 15000,
  });
  if (isLoading) return <Loader label="Loading placement records…" />;
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
              <br />{r.placed}/{r.total} applicants placed · {r.conversion}% conversion
              <br />Average CTC: {r.average} LPA · Highest: {r.highest} LPA
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
  if (verify)
    return (
      <div className="content-width" style={{ maxWidth: 560, padding: '80px 20px' }}>
        <h1>You can sign in directly</h1>
        <p>Email verification is not required.</p>
        <Link href="/login">Go to sign in</Link>
      </div>
    );
  return (
    <div className="content-width" style={{ maxWidth: 560, padding: '80px 20px' }}>
      <h1>Reset your password</h1>
      <form
        method="post"
        className="panel form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const token = new URLSearchParams(window.location.search).get('token');
            const { data } = await apiClient.post('/auth/reset-password', { token, password });
            setMessage(data.message);
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
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
        <Button type="submit" disabled={busy}>
          Save new password
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
  const { data, isPending, isError } = useQuery<{
    label: string;
    risk: string;
    factors: string[];
    score?: number;
    categories?: PreparationCategory[];
    ml?: {
      status: string;
      message: string;
    };
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
        <PreparationOverview
          score={data?.score}
          categories={data?.categories}
          loading={isPending}
          error={isError}
        />
        {data?.ml && <AnalysisSource status={data.ml.status} />}
        {data?.model.available &&
        data.model.provenance === 'historical' &&
        data.categories?.some((c) => c.recorded) ? (
          <p>
            Historical model estimate : {data.model.probability}%. This is not a placement
            guarantee.
          </p>
        ) : null}
        {data && (
          <details className="preparation-methods">
            <summary>About this summary</summary>
            <p>
              Your recorded skills, academics, projects and practice results form this preparation
              score. Areas without evidence are marked “Not added” and do not receive points. This
              is a preparation guide, not a hiring decision or a placement guarantee.
            </p>
            {(!data.model.available || data.model.provenance !== 'historical') && (
              <p>Historical outcome insights are not available yet.</p>
            )}
            {data.model.provenance === 'historical' && (
              <p className="muted">
                This estimate uses current preparation scores. Confirm that their scoring rubrics
                match the historical training data before interpreting the probability.
              </p>
            )}
            {data.model.limitations?.map((limitation) => (
              <p key={limitation} className="muted">
                {limitation}
              </p>
            ))}
          </details>
        )}
      </section>
      <section className="panel sage career-assistant">
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
    website?: string;
    logo?: string;
    size?: string;
  }>({
    queryKey: ['organization'],
    queryFn: async () => (await apiClient.get('/organization')).data,
  });
  if (!data) return <Loader label="Loading your company profile…" />;
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
                ['name', 'description', 'industry', 'headquarters', 'website', 'logo', 'size'].map(
                  (k) => [k, String(form.get(k))],
                ),
              ),
            );
            void client.invalidateQueries({ queryKey: ['organization'] });
            setMessage('Company profile saved.');
          } catch (e) {
            setMessage((e as Error).message);
          }
        }}
      >
        {(['name', 'industry', 'headquarters', 'website', 'logo', 'size'] as const).map((k) =>
          k === 'name' ? (
            <OrganizationPicker
              key={k}
              kind="companies"
              label="Company name"
              name="name"
              defaultValue={data.name}
            />
          ) : (
            <FormField key={k} label={k}>
              <input name={k} defaultValue={data[k]} maxLength={150} />
            </FormField>
          ),
        )}
        <FormField label="About your company">
          <textarea name="description" defaultValue={data.description} maxLength={5000} rows={5} />
        </FormField>
        <Button type="submit">Save profile</Button>
        <p role="status">{message}</p>
      </form>
    </section>
  );
}
