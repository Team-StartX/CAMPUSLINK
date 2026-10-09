'use client';

import { CheckCircle2, CircleAlert, ClipboardCheck } from 'lucide-react';
import type { RecruitmentOverview } from '@/types/recruitment';
import { Button } from './ui';
import styles from './candidate-eligibility.module.css';

export function CandidateEligibility({
  overview,
  conditions,
  canReview,
  busy,
  onReview,
}: {
  overview: RecruitmentOverview;
  conditions?: string;
  canReview: boolean;
  busy: boolean;
  onReview: (studentId: string, approved: boolean, reason: string) => void;
}) {
  const eligible = overview.eligibleCandidates || [];
  const ineligible = overview.ineligibleCandidates || [];
  const reviews = overview.eligibilityReviews || [];
  const pending = reviews.filter((student) => !student.approved).length;
  return (
    <section className={styles.section} aria-label="Student eligibility">
      <header className={styles.heading}>
        <div>
          <h3>Student eligibility</h3>
          <p>Based on this job’s requirements and current student profiles.</p>
        </div>
      </header>
      <div className={styles.grid}>
        <details className={`${styles.group} ${styles.eligible}`} open>
          <summary>
            <CheckCircle2 size={19} />
            <span>Eligible students</span>
            <b>{eligible.length}</b>
          </summary>
          <div className={styles.list}>
            {eligible.length ? (
              eligible.map((student) => (
                <div className={styles.student} key={student.studentId}>
                  <div>
                    <strong>{student.name}</strong>
                    <small>{student.branch || 'Branch not recorded'}</small>
                  </div>
                  <span className={styles.pill}>Eligible</span>
                </div>
              ))
            ) : (
              <p className={styles.empty}>No students currently meet all requirements.</p>
            )}
          </div>
        </details>
        <details className={`${styles.group} ${styles.ineligible}`} open>
          <summary>
            <CircleAlert size={19} />
            <span>Not eligible</span>
            <b>{ineligible.length}</b>
          </summary>
          <div className={styles.list}>
            {ineligible.length ? (
              ineligible.map((student) => (
                <div className={styles.student} key={student.studentId}>
                  <div>
                    <strong>{student.name}</strong>
                    <small>{student.branch || 'Branch not recorded'}</small>
                    <ul>
                      {student.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                  <span className={styles.pill}>Not eligible</span>
                </div>
              ))
            ) : (
              <p className={styles.empty}>No students are listed as not eligible.</p>
            )}
          </div>
        </details>
      </div>
      {canReview && conditions?.trim() && reviews.length > 0 && (
        <details className={styles.reviews}>
          <summary>
            <ClipboardCheck size={19} />
            <span>Review additional conditions</span>
            <b>{pending} unverified</b>
          </summary>
          <div className={styles.reviewBody}>
            <p>
              Campus review is needed for written recruiter conditions. Confirm these separately
              from the automatic eligibility checks.
            </p>
            <div className={styles.conditions}>
              <small>RECRUITER CONDITIONS</small>
              <strong>{conditions}</strong>
            </div>
            {reviews.map((student) => (
              <details className={styles.review} key={student.studentId}>
                <summary>
                  <strong>{student.name}</strong>
                  <span className={student.approved ? styles.verified : styles.pending}>
                    {student.approved ? 'Verified' : 'Not verified'}
                  </span>
                  <span className={styles.edit}>Review</span>
                </summary>
                <form
                  className={styles.form}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    onReview(
                      student.studentId,
                      form.get('approved') === 'yes',
                      String(form.get('reason')),
                    );
                  }}
                >
                  <label>
                    Decision
                    <select name="approved" required defaultValue={student.approved ? 'yes' : ''}>
                      <option value="" disabled>
                        Select a decision
                      </option>
                      <option value="yes">Conditions met</option>
                      <option value="no">Conditions not met</option>
                    </select>
                  </label>
                  <label>
                    Evidence or reason
                    <input
                      name="reason"
                      required
                      minLength={5}
                      placeholder="Explain your decision"
                    />
                  </label>
                  <Button type="submit" disabled={busy}>
                    Save review
                  </Button>
                </form>
              </details>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
