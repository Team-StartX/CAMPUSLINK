import styles from './loader.module.css';

export function LoadingSpinner() {
  return <span className={styles.spinner} aria-hidden="true" />;
}

export function Loader({
  label = 'Loading your workspace…',
  fullPage = false,
  compact = false,
}: {
  label?: string;
  fullPage?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`${styles.loader} ${fullPage ? styles.fullPage : ''} ${compact ? styles.compact : ''}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className={styles.mark} aria-hidden="true">
        <span className={styles.ring} />
        <span className={styles.ring} />
        <span className={styles.dot} />
      </span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
