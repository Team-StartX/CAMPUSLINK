'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Code2, FileText, Plus, Sparkles } from 'lucide-react';
import { aiService, studentService } from '@/services/platform.service';
import { normalizeSkill } from '@/utils/skills';
import type { WorkspaceData } from '@/types';
import type { ResumeAnalysis, SkillPractice } from '@/types/resume';
import { AnalysisSource } from './external-analysis-setting';
import { Button } from './ui';

export function ResumeReview({
  analysis,
  name,
  data,
  refresh,
}: {
  analysis: ResumeAnalysis;
  name: string;
  data: WorkspaceData;
  refresh: () => void;
}) {
  const [added, setAdded] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [level, setLevel] = useState('Beginner');
  const [practice, setPractice] = useState<SkillPractice | null>(null);
  const practicePanel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (practice) {
      practicePanel.current?.scrollIntoView({ block: 'start' });
      practicePanel.current?.focus({ preventScroll: true });
    }
  }, [practice]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const skills = [
    ...new Map(
      (analysis.skills || [])
        .filter((s) => s.trim() && s.length <= 80)
        .map((s) => [normalizeSkill(s), s.trim()]),
    ).values(),
  ];
  const onProfile = (skill: string) =>
    added.includes(normalizeSkill(skill)) ||
    data.student.skills.some((s) => normalizeSkill(s.name) === normalizeSkill(skill));
  const saved = skills.filter(onProfile).length;
  async function addAndPractice(skill: string) {
    if (busy) return;
    setBusy(skill);
    setError('');
    setPractice(null);
    setNotes({});
    try {
      if (!onProfile(skill)) {
        await studentService.addSkill(skill, level);
        setAdded((list) => [...list, normalizeSkill(skill)]);
        await refresh();
      }
      setPractice(await aiService.getSkillPractice(skill));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy('');
    }
  }
  const assessment =
    practice &&
    data.assessments.find(
      (a) => a.skill && normalizeSkill(a.skill) === normalizeSkill(practice.skill),
    );
  return (
    <section className="panel resume-analysis" aria-label="Resume analysis results">
      <div className="review-heading">
        <div>
          <span className="eyebrow">YOUR RESUME, DECODED</span>
          <h2>{name}</h2>
          <p>Review what we found, build your profile, then practice your skills.</p>
        </div>
        <FileText size={30} />
      </div>
      <AnalysisSource status={analysis.ml?.status} />
      {analysis.ml && analysis.ml.status !== 'remote' && (
        <details className="review-source">
          <summary>Analysis details</summary>
          <p>{analysis.ml.message}</p>
        </details>
      )}
      <div className="insight-metrics">
        <div>
          <Code2 size={20} />
          <strong>{skills.length}</strong>
          <span>Skills detected</span>
        </div>
        <div>
          <FileText size={20} />
          <strong>{analysis.wordCount ?? '—'}</strong>
          <span>Words reviewed</span>
        </div>
        <div>
          <Sparkles size={20} />
          <strong>{analysis.suggestions.length}</strong>
          <span>Suggestions to review</span>
        </div>
      </div>
      <div className="review-columns">
        <div className="review-skills">
          <h3>Turn your experience into profile skills</h3>
          <p>Confirm each skill before adding it. Added skills start unverified.</p>
          <div className="skill-coverage">
            <span>
              {saved} of {skills.length} detected skills on your profile
            </span>
            <progress
              aria-label="Detected skills on your profile"
              max={Math.max(1, skills.length)}
              value={saved}
            />
          </div>
          <label className="review-level">
            Your level for new skills
            <select
              value={level}
              disabled={Boolean(busy)}
              onChange={(e) => setLevel(e.target.value)}
            >
              {['Beginner', 'Intermediate', 'Advanced'].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <div className="extracted-skills">
            {skills.map((skill) => (
              <div className="extracted-skill" key={normalizeSkill(skill)}>
                <div>
                  <b>{skill}</b>
                  <small>{onProfile(skill) ? 'On your profile' : 'Detected in your resume'}</small>
                </div>
                <Button
                  kind={onProfile(skill) ? 'outline' : 'dark'}
                  disabled={Boolean(busy)}
                  loading={busy === skill}
                  onClick={() => void addAndPractice(skill)}
                >
                  {onProfile(skill) ? <Check size={14} /> : <Plus size={14} />}{' '}
                  {busy === skill
                    ? 'Preparing questions…'
                    : onProfile(skill)
                      ? 'Practice'
                      : 'Add skill to profile'}
                </Button>
              </div>
            ))}
          </div>
          {!skills.length && (
            <p>
              No recognizable skills found. <Link href="/student/skills">Add a skill manually</Link>
              .
            </p>
          )}
        </div>
        <div className="review-suggestions">
          <h3>Make your next version stronger</h3>
          <p>Suggestions are prompts for your review, not a hiring score.</p>
          <ol>
            {analysis.suggestions.map((s, i) => (
              <li key={i}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <p>{s}</p>
              </li>
            ))}
          </ol>
          {!analysis.suggestions.length && (
            <p className="review-empty">
              <Check size={18} /> No suggestions from this check. Review accuracy and tailoring
              before applying.
            </p>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="document-error">
          {error}
        </p>
      )}
      {busy && (
        <p role="status" className="document-progress">
          Preparing questions for {busy}…
        </p>
      )}
      {practice && (
        <section
          ref={practicePanel}
          tabIndex={-1}
          className="skill-practice"
          aria-label={`${practice.skill} practice questions`}
        >
          <div className="review-heading">
            <div>
              <span className="eyebrow">NEXT STEP · PRACTICE</span>
              <h3>{practice.skill} questions</h3>
              <p>{practice.message}</p>
            </div>
            <span className="badge">
              {practice.source === 'gemini'
                ? 'Gemini'
                : practice.source === 'openai'
                  ? 'OpenAI'
                  : 'Guided practice'}
            </span>
          </div>
          <p className="muted">
            Practice notes stay on this page. These questions do not award verification or XP.{' '}
            <Link href="/student/settings#analysis-preferences">AI preferences</Link>
          </p>
          {practice.questions.map((q, i) => (
            <article className="practice-question" key={i}>
              <label htmlFor={`practice-answer-${i}`}>
                <span>QUESTION {i + 1}</span>
                <h4>{q.prompt}</h4>
              </label>
              <textarea
                id={`practice-answer-${i}`}
                rows={3}
                value={notes[i] || ''}
                onChange={(e) => setNotes((n) => ({ ...n, [i]: e.target.value }))}
                placeholder="Try your answer here…"
              />
              <details>
                <summary>Review answer checkpoints</summary>
                <ul>
                  {q.checkpoints.map((c, j) => (
                    <li key={j}>{c}</li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
          <Link
            className="button dark"
            href={assessment ? `/student/assessments/${assessment.id}` : '/student/skills'}
          >
            Continue to skill verification
          </Link>
        </section>
      )}
    </section>
  );
}
