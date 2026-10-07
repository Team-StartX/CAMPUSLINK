'use client';
import { Loader } from '@/components/loader';
import { Badge, FormField, PageHeader } from '@/components/ui';
import { useVoicePractice } from '@/hooks/use-voice-practice';
import { interviewService } from '@/services/platform.service';
import { useSession } from '@/store/session';
import {
  communicationInputSchema,
  communicationPrompts,
  type CommunicationFeedback,
} from '@/utils/communication';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  Clock,
  History,
  Mic,
  RotateCcw,
  Sparkles,
  Square,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
export function CommunicationPractice() {
  const voice = useVoicePractice();
  const user = useSession((state) => state.user);
  const client = useQueryClient();
  const [promptId, setPromptId] =
    useState<(typeof communicationPrompts)[number]['id']>('introduction');
  const [speechConsent, setSpeechConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<CommunicationFeedback | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!feedback) return;
    resultHeading.current?.focus({ preventScroll: true });
    resultHeading.current?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  }, [feedback]);
  const prompt = communicationPrompts.find((item) => item.id === promptId)!;
  const queryKey = ['communication-history', user?.id];
  const history = useQuery({ queryKey, queryFn: interviewService.getCommunicationHistory });
  const wordCount = (voice.transcript.match(/\b[\w']+\b/g) || []).length;
  async function review() {
    const input = communicationInputSchema.safeParse({
      promptId,
      transcript: voice.transcript,
      mode: voice.voiceSeconds !== null ? 'voice' : 'text',
      seconds: voice.voiceSeconds,
    });
    if (!input.success) {
      setError(input.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await interviewService.analyzeCommunication(input.data);
      setFeedback(result);
      await client.invalidateQueries({ queryKey });
    } catch {
      setError('We could not save your feedback. Your transcript is still here; please try again.');
    } finally {
      setBusy(false);
    }
  }
  function freshTake() {
    voice.reset();
    setFeedback(null);
    setError('');
  }
  return (
    <div className="communication-page">
      <PageHeader
        eyebrow="YOUR VOICE. YOUR NEXT CHAPTER."
        title="Speak. Reflect. Improve."
        description="Practice your communication, spot possible mistakes, and build a clearer answer."
        action={
          <Link href="/student/interviews" className="button outline">
            Interview hub <ArrowRight size={16} />
          </Link>
        }
      />
      <div className="communication-layout">
        <section className="panel communication-prompt lavender">
          <span className="communication-icon">
            <Mic size={28} />
          </span>
          <Badge>ENGLISH COMMUNICATION PRACTICE</Badge>
          <h2>
            One clear idea.
            <br /> One confident step.
          </h2>
          <FormField label="Choose a practice prompt">
            <select
              aria-label="Choose a practice prompt"
              value={promptId}
              disabled={voice.active || busy}
              onChange={(event) => {
                setPromptId(event.target.value as typeof promptId);
                freshTake();
              }}
            >
              {communicationPrompts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </FormField>
          <div className="communication-question">
            <span>YOUR PROMPT</span>
            <h3>{prompt.question}</h3>
            <p>{prompt.hint}</p>
          </div>
          <div className="communication-guide">
            <Clock size={16} />
            <p>Aim for 60–90 seconds. Each take stops after 3 minutes.</p>
          </div>
          <ul className="communication-checklist">
            <li>
              <Check size={15} /> Possible grammar mistakes with corrections
            </li>
            <li>
              <Check size={15} /> Filler words and repeated phrases
            </li>
            <li>
              <Check size={15} /> Answer structure and improvement tips
            </li>
            <li>
              <Check size={15} /> Approximate pace for voice responses
            </li>
          </ul>
        </section>
        <section className="panel communication-recorder">
          <div className="panel-header">
            <h3>Your practice space</h3>
            <Badge>{voice.voiceSeconds !== null ? 'Voice response' : 'Voice or text'}</Badge>
          </div>
          <div
            className={`communication-mic ${voice.status === 'listening' ? 'is-listening' : ''}`}
          >
            <Mic size={34} aria-hidden="true" />
            <div className="communication-wave" aria-hidden="true">
              {Array.from({ length: 13 }, (_, index) => (
                <span
                  key={index}
                  style={
                    {
                      '--bar-height': `${14 + ((index * 13) % 29)}px`,
                      '--bar-delay': `${index * 65}ms`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
            <strong>
              {Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, '0')}
            </strong>
            <p role="status">
              {voice.status === 'listening'
                ? 'Listening — speak naturally.'
                : voice.status === 'requesting'
                  ? 'Waiting for microphone access…'
                  : voice.status === 'stopping'
                    ? 'Finishing your transcript…'
                    : 'Ready when you are.'}
            </p>
          </div>
          {!voice.supported && (
            <p className="communication-notice">
              Voice input is not available for this workspace or browser. You can still type a
              response for feedback.
            </p>
          )}
          {voice.supported && (
            <label className="communication-consent">
              <input
                type="checkbox"
                checked={speechConsent}
                disabled={voice.active || busy}
                onChange={(event) => setSpeechConsent(event.target.checked)}
              />
              <span>
                Allow CampusLink to send this recording to OpenAI for transcription. Audio is
                uploaded when you stop recording. CampusLink does not save the audio recording.
                Review the transcript before saving practice feedback.
              </span>
            </label>
          )}
          <div className="communication-controls">
            {voice.active ? (
              <button
                type="button"
                className="button dark"
                onClick={voice.stop}
                disabled={voice.status === 'stopping'}
              >
                <Square size={15} />
                {voice.status === 'stopping' ? 'Finishing…' : 'Stop speaking'}
              </button>
            ) : (
              <button
                type="button"
                className="button dark"
                disabled={!voice.supported || !speechConsent || busy}
                onClick={() => {
                  setFeedback(null);
                  setError('');
                  voice.start();
                }}
              >
                <Mic size={16} />
                {voice.transcript ? 'Record a new take' : 'Start speaking'}
              </button>
            )}
            <button
              type="button"
              className="button outline"
              disabled={voice.active || busy || !voice.transcript}
              onClick={freshTake}
            >
              <RotateCcw size={15} />
              Reset
            </button>
          </div>
          <FormField label="Your transcript — review recognition mistakes before getting feedback">
            <textarea
              aria-label="Your transcript"
              rows={7}
              maxLength={6000}
              value={voice.transcript}
              disabled={voice.active || busy}
              placeholder="Your spoken words appear here. You can also type a practice response…"
              onChange={(event) => {
                voice.edit(event.target.value);
                setFeedback(null);
                setError('');
              }}
            />
          </FormField>
          {voice.interim && (
            <p className="communication-interim" aria-live="polite">
              Recognizing: {voice.interim}
            </p>
          )}
          <div className="communication-transcript-meta">
            <span>
              {wordCount} words · {voice.transcript.length}/6,000 characters
            </span>
            <span>
              {voice.voiceSeconds === null
                ? 'Text edits do not get a speaking-pace estimate.'
                : 'Pace uses recognized words and recording duration.'}
            </span>
          </div>
          {(voice.error || error) && (
            <p className="field-error" role="alert">
              {voice.error || error}
            </p>
          )}
          <button
            type="button"
            className="button dark communication-submit"
            disabled={voice.active || busy || wordCount < 8 || voice.transcript.trim().length < 20}
            onClick={review}
          >
            <Sparkles size={17} />
            {busy ? 'Reviewing your response…' : 'Get feedback & save practice'}
            <ArrowRight size={16} />
          </button>
          <p className="communication-footnote">
            Grammar and structure checks use your transcript. Speech recognition can change or omit
            words. This practice does not evaluate pronunciation or accent.{' '}
            {'Optional AI coaching follows your saved AI sharing preference.'}
          </p>
        </section>
      </div>
      {feedback && (
        <section
          className="panel communication-feedback"
          aria-labelledby="communication-feedback-heading"
        >
          <div className="panel-header">
            <div>
              <span className="eyebrow">YOUR PRACTICE REVIEW</span>
              <h2 id="communication-feedback-heading" ref={resultHeading} tabIndex={-1}>
                Small changes. A clearer message.
              </h2>
              <p>
                {communicationPrompts.find((item) => item.id === feedback.input.promptId)?.title} ·{' '}
                {new Date(feedback.date).toLocaleString('en-IN')}
              </p>
            </div>
            <Badge>{feedback.source}</Badge>
          </div>
          <div className="communication-metrics">
            <div>
              <span>Words recognized / entered</span>
              <strong>{feedback.metrics.words}</strong>
            </div>
            <div>
              <span>Filler phrases found</span>
              <strong>
                {feedback.metrics.fillers}
                <small>{feedback.metrics.fillerPercent} phrases / 100 words</small>
              </strong>
            </div>
            <div>
              <span>Approximate speaking pace</span>
              <strong>
                {feedback.metrics.wordsPerMinute ?? '—'}
                <small>
                  {feedback.metrics.wordsPerMinute === null
                    ? 'Needs an unedited voice take of 15+ seconds and 20+ words'
                    : 'words / minute, including pauses'}
                </small>
              </strong>
            </div>
          </div>
          <div className="communication-review-grid">
            <div>
              <h3>
                <TriangleAlert size={17} /> Possible errors & improvements
              </h3>
              <p className="muted">
                Check the original wording before treating a transcript issue as a speaking mistake.
              </p>
              {feedback.issues.length ? (
                <div className="communication-issues">
                  {feedback.issues.map((issue, index) => (
                    <article key={index}>
                      <Badge>{issue.kind}</Badge>
                      {issue.quote && (
                        <div className="communication-correction">
                          <q>{issue.quote}</q>
                          <ArrowRight size={14} />
                          <strong>{issue.correction}</strong>
                        </div>
                      )}
                      {!issue.quote && <strong>{issue.correction}</strong>}
                      <p>{issue.explanation}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="communication-notice">
                  No issues were found by these limited checks. That does not mean every sentence is
                  error-free.
                </p>
              )}
            </div>
            <aside className="communication-next">
              <h3>
                <Check size={17} /> What worked
              </h3>
              <ul>
                {feedback.strengths.map((strength) => (
                  <li key={strength}>{strength}</li>
                ))}
              </ul>
              <h3>
                <Sparkles size={17} /> Your next attempt
              </h3>
              <ol>
                {feedback.nextSteps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
              <button type="button" className="button outline" onClick={freshTake}>
                <RotateCcw size={15} />
                Try again
              </button>
            </aside>
          </div>
          {feedback.coaching && (
            <section className="communication-ai">
              <Badge>AI COACHING</Badge>
              <h3>A closer look at your answer</h3>
              <p>{feedback.coaching.summary}</p>
              <ul>
                {feedback.coaching.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </section>
          )}
          {feedback.coachingStatus === 'unavailable' && (
            <p role="status" className="communication-notice">
              AI coaching is temporarily unavailable. Your transcript feedback was still saved.
            </p>
          )}
          <details className="communication-saved-text">
            <summary>Review the transcript used for this feedback</summary>
            <p>{feedback.input.transcript}</p>
          </details>
        </section>
      )}
      <section className="panel communication-history">
        <div className="panel-header">
          <h3>
            <History size={18} /> Your recent practice
          </h3>
          <Badge>Latest 15 takes</Badge>
        </div>
        {history.isPending ? (
          <Loader compact label="Loading your practice history…" />
        ) : history.isError ? (
          <p role="alert">
            Could not load history.{' '}
            <button className="text-button" onClick={() => void history.refetch()}>
              Try again
            </button>
          </p>
        ) : !history.data?.length ? (
          <p>
            Your first practice starts here. Saved feedback will appear here so you can review your
            progress.
          </p>
        ) : (
          <div className="communication-history-list">
            {history.data.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={voice.active || busy}
                onClick={() => setFeedback(item)}
                aria-pressed={feedback?.id === item.id}
              >
                <span className="communication-history-icon">
                  <Mic size={17} />
                </span>
                <span>
                  <strong>
                    {
                      communicationPrompts.find((prompt) => prompt.id === item.input.promptId)
                        ?.title
                    }
                  </strong>
                  <small>
                    {new Date(item.date).toLocaleString('en-IN')} ·{' '}
                    {item.input.mode === 'voice' ? 'Voice' : 'Text'}
                  </small>
                </span>
                <span>
                  {item.metrics.words} words
                  <br />
                  <small>{item.metrics.fillers} fillers</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
