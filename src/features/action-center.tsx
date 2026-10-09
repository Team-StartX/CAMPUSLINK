'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, Download, Search, CheckCircle2, ListTodo } from 'lucide-react';
import { WorkspaceData, Role } from '@/types';
import { actionCalendar, workspaceActions } from '@/utils/workspace-actions';
import { Badge, Button, EmptyState, PageHeader } from '@/components/ui';
import { useQuery } from '@tanstack/react-query';
import { recruitmentService } from '@/services/recruitment.service';
import { useSession } from '@/store/session';

export function ActionCenter({
  data,
  role,
  compact = false,
}: {
  data: WorkspaceData;
  role: Role;
  compact?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const userId = useSession((s) => s.user?.id);
  const relationships = useQuery({
    queryKey: ['relationships', role, userId],
    queryFn: recruitmentService.relationships,
    enabled: role === 'campus' && Boolean(userId),
    refetchInterval: 15000,
  });
  const loadingRequests = role === 'campus' && relationships.isLoading;
  const requestsError = role === 'campus' ? relationships.error : null;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const actions = workspaceActions(data, role, today, relationships.data);
  const dated = actions.filter((a) => a.date);
  const visible = actions.filter(
    (a) =>
      (filter === 'All' ||
        (filter === 'High priority' ? a.priority === 'High' : a.category === filter)) &&
      `${a.title} ${a.detail}`.toLowerCase().includes(query.toLowerCase()),
  );
  function download() {
    const url = URL.createObjectURL(
      new Blob([actionCalendar(dated)], { type: 'text/calendar;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `placedin-${role}-calendar.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      {!compact && (
        <PageHeader
          eyebrow="YOUR NEXT STEPS"
          title="Less searching. More progress."
          description={
            role === 'student'
              ? 'Your applications, preparation, and upcoming conversations in one place.'
              : role === 'campus'
                ? 'Keep approvals, document reviews, and placement coordination moving.'
                : 'Keep campus requests, candidate reviews, and interviews moving.'
          }
          action={
            <Button kind="outline" disabled={!dated.length} onClick={download}>
              <Download size={16} /> Export calendar
            </Button>
          }
        />
      )}
      {!compact && (
        <section className="action-hero">
          <div>
            <span className="tiny-label">ACTION CENTER</span>
            <h2>A clear plan for what comes next.</h2>
            <p>
              Built from your workspace records. Complete an action in its workflow and this list
              updates automatically.
            </p>
            <Link href={`/${role}/dashboard`} className="button outline">
              View overview <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="action-stats">
            {[
              [actions.length, 'Open actions', ListTodo],
              [actions.filter((a) => a.priority === 'High').length, 'High priority', CheckCircle2],
              [dated.length, 'Dates to remember', CalendarDays],
            ].map(([count, label, Icon]) => {
              const Glyph = Icon as typeof ListTodo;
              return (
                <div key={String(label)}>
                  <Glyph size={20} />
                  <b>{String(count)}</b>
                  <span>{String(label)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <section className="panel action-panel">
        <div className="action-toolbar">
          <div>
            <h2>Your work queue</h2>
            <p aria-live="polite">
              {visible.length} of {actions.length} actions
            </p>
          </div>
          <label className="action-search">
            <Search size={18} />
            <input
              aria-label="Search actions"
              placeholder="Search company, role, or skill"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="filter-pills">
          {['All', 'High priority', ...new Set(actions.map((a) => a.category))].map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              className={filter === f ? 'selected' : ''}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        {loadingRequests && <p role="status">Loading pending recruiter requests…</p>}
        {requestsError && (
          <div role="alert">
            <p>Recruiter requests could not be loaded. {requestsError.message}</p>
            <Button kind="outline" onClick={() => void relationships.refetch()}>
              Retry requests
            </Button>
          </div>
        )}
        <div className="action-list">
          {visible.map((a) => (
            <Link className="action-row" key={a.id} href={a.href}>
              <span className={`action-mark ${a.priority === 'High' ? 'urgent' : ''}`}>
                <ListTodo size={20} />
              </span>
              <div className="action-copy">
                <small>{a.category}</small>
                <h3>{a.title}</h3>
                <p>{a.detail}</p>
              </div>
              <div className="action-meta">
                <Badge kind={a.priority === 'High' ? 'pending' : ''}>{a.priority} priority</Badge>
                {a.date && (
                  <span>
                    <CalendarDays size={14} />
                    {new Date(`${a.date}T12:00:00`).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>
              <ArrowUpRight size={18} />
            </Link>
          ))}
        </div>
        {!visible.length && !loadingRequests && !requestsError && (
          <EmptyState
            title={actions.length ? 'No matching actions' : 'You’re up to date'}
            description={
              actions.length
                ? 'Try another search or clear your filters.'
                : 'New steps will appear as your placement journey progresses.'
            }
            action={
              actions.length ? (
                <Button
                  kind="outline"
                  onClick={() => {
                    setQuery('');
                    setFilter('All');
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        )}
      </section>
      {compact ? (
        <Link href={`/${role}/actions`} className="text-link">
          View full Action Center
        </Link>
      ) : (
        <p className="muted">
          Calendar exports contain all upcoming dates, regardless of filters. Events are all-day
          reminders; interview times remain in the description. Re-export after schedule changes.
        </p>
      )}
    </>
  );
}
