'use client';
import type { WorkspaceData } from '@/types';
import { Badge } from './ui';

export function RecruiterFeedback({ data }: { data: WorkspaceData }) {
  const feedback = data.recruiterFeedback || [];
  return (
    <section className="panel">
      <h2>My recruiter interview feedback</h2>
      <p>
        Your published interview decisions and improvement areas. Follow-up risk is high for
        rejected or absent results, moderate for qualified results with recorded gaps, and low for
        qualified results without recorded gaps.
      </p>
      {!feedback.length && <p>No recruiter interview feedback has been published yet.</p>}
      {feedback.map((result) => (
        <article key={result.id} className="panel">
          <h3>
            {result.company} · {result.role}
          </h3>
          <p>
            {result.round} · <Badge>{result.status}</Badge>{' '}
            <Badge>Follow-up risk: {result.risk}</Badge>
          </p>
          {result.score !== undefined && <p>Interview score: {result.score}</p>}
          <p>{result.feedback || 'No written feedback recorded.'}</p>
          <p>
            <strong>Strengths:</strong> {result.strengths || 'Not recorded by recruiter.'}
          </p>
          <p>
            <strong>Problems and skill gaps:</strong>{' '}
            {result.gaps || 'No specific gaps recorded by recruiter.'}
          </p>
          <p>
            <strong>Next steps:</strong>{' '}
            {result.nextSteps || 'Review your feedback and prepare for your next interview.'}
          </p>
        </article>
      ))}
    </section>
  );
}
