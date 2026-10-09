'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCheck,
  Gift,
  Search,
  Trophy,
} from 'lucide-react';
import type { Notification, Role, WorkspaceData } from '@/types';
import { notificationService } from '@/services/platform.service';
import { notificationHref } from '@/utils/notification-links';
import styles from './notifications.module.css';

function category(notification: Notification) {
  const topic = `${notification.type} ${notification.title}`.toLowerCase();
  if (/offer|joining/.test(topic)) return { name: 'Offers', icon: Gift, color: 'pink' };
  if (/result|feedback|qualified|rejected/.test(topic))
    return { name: 'Results', icon: Trophy, color: 'yellow' };
  if (/interview|schedule/.test(topic))
    return { name: 'Interviews', icon: CalendarDays, color: 'lavender' };
  if (/job|drive|placement|recruit/.test(topic))
    return { name: 'Jobs', icon: BriefcaseBusiness, color: 'sage' };
  return { name: 'Updates', icon: Bell, color: 'blue' };
}

export function Notifications({
  data,
  role,
  refresh,
  notify,
}: {
  data: WorkspaceData;
  role: Role;
  refresh: () => void;
  notify: (message: string) => void;
}) {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState('');
  const router = useRouter();
  const unread = data.notifications.filter((item) => !item.read).length;
  const items = data.notifications
    .filter(
      (item) =>
        (filter === 'All' || (filter === 'Unread' ? !item.read : category(item).name === filter)) &&
        `${item.title} ${item.body} ${item.type}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort((a, b) => {
      const timestamp = (item: Notification) =>
        item.createdAt ? Date.parse(item.createdAt) || 0 : 0;
      return timestamp(b) - timestamp(a);
    });
  const markRead = async (id?: string) => {
    setPending(id || 'all');
    try {
      await notificationService.markRead(id);
      await refresh();
      if (!id) notify('All notifications marked as read.');
    } catch {
      notify('Could not mark notifications as read. Please try again.');
    } finally {
      setPending('');
    }
  };
  return (
    <div className={styles.inbox}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>STAY IN THE LOOP</span>
          <h1>Your inbox</h1>
          <p>New opportunities, interview updates, and your next steps—all in one place.</p>
        </div>
        <button
          className={styles.markAll}
          disabled={!unread || !!pending}
          onClick={() => void markRead()}
        >
          <CheckCheck size={17} /> {pending === 'all' ? 'Marking as read…' : 'Mark all as read'}
        </button>
      </header>
      <section className={styles.summary} aria-label="Notification summary">
        <span className={styles.summaryIcon}>
          <Bell size={22} />
        </span>
        <div>
          <strong>
            {unread
              ? `${unread} unread ${unread === 1 ? 'update' : 'updates'}`
              : 'You’re all caught up'}
          </strong>
          <p>
            {unread
              ? 'A few things are waiting for your attention.'
              : 'Your next opportunity will appear here.'}
          </p>
        </div>
        <span className={styles.total}>{data.notifications.length} total</span>
      </section>
      <section className={styles.content}>
        <div className={styles.toolbar}>
          <div className={styles.filters} aria-label="Filter notifications">
            {['All', 'Unread', 'Jobs', 'Interviews', 'Results', 'Offers'].map((name) => (
              <button
                key={name}
                aria-pressed={filter === name}
                className={filter === name ? styles.active : ''}
                onClick={() => setFilter(name)}
              >
                {name}
                {name === 'Unread' && unread > 0 && <span>{unread}</span>}
              </button>
            ))}
          </div>
          <label className={styles.search}>
            <Search size={17} />
            <input
              aria-label="Search notifications"
              placeholder="Search updates…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <div className={styles.list}>
          {items.map((item) => {
            const topic = category(item);
            const Icon = topic.icon;
            const date = item.createdAt ? new Date(item.createdAt) : null;
            return (
              <article
                key={item.id}
                className={`${styles.card} ${!item.read ? styles.unread : ''}`}
              >
                <button
                  className={styles.open}
                  disabled={!!pending}
                  onClick={async () => {
                    if (!item.read) await markRead(item.id);
                    router.push(notificationHref(item, role));
                  }}
                >
                  <span className={`${styles.icon} ${styles[topic.color]}`}>
                    <Icon size={21} />
                  </span>
                  <div className={styles.message}>
                    <div className={styles.meta}>
                      <span>{topic.name}</span>
                      {date && !Number.isNaN(date.getTime()) && (
                        <time dateTime={item.createdAt}>
                          {date.toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </time>
                      )}
                      {!item.read && <span className={styles.new}>Unread</span>}
                    </div>
                    <h2>{item.title}</h2>
                    <p>{item.body}</p>
                    <span className={styles.view}>
                      View update <ArrowUpRight size={14} />
                    </span>
                  </div>
                </button>
                <div className={styles.readAction}>
                  {item.read ? (
                    <span>
                      <Check size={14} /> Read
                    </span>
                  ) : (
                    <button
                      disabled={!!pending}
                      aria-label={`Mark ${item.title} as read`}
                      title="Mark as read"
                      onClick={() => void markRead(item.id)}
                    >
                      <CheckCheck size={18} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {!items.length && (
            <div className={styles.empty}>
              <span>
                <Bell size={28} />
              </span>
              <h2>
                {search
                  ? 'No matching updates'
                  : filter === 'Unread'
                    ? 'All caught up!'
                    : 'Nothing here yet'}
              </h2>
              <p>
                {search
                  ? 'Try another search or choose a different filter.'
                  : 'New updates will appear here when there’s something for you.'}
              </p>
              {(search || filter !== 'All') && (
                <button
                  onClick={() => {
                    setFilter('All');
                    setSearch('');
                  }}
                >
                  See all updates
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
