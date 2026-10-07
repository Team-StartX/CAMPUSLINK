'use client';
import { ShieldCheck, Sparkles } from 'lucide-react';

export function ExternalAnalysisSetting({
  enabled,
  destination,
  busy,
  onChange,
}: {
  enabled: boolean;
  destination: string;
  busy: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="analysis-setting">
      <div className="analysis-setting-header">
        <div className="analysis-setting-title">
          <span className="analysis-setting-icon">
            <Sparkles size={17} />
          </span>
          <div>
            <h3>External AI analysis</h3>
            <span className="analysis-setting-state" role="status">
              <b>{busy ? 'Saving…' : enabled ? 'On' : 'Off'}</b> ·{' '}
              {enabled ? 'Optional model insights enabled' : 'Built-in analysis available'}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="analysis-setting-switch"
          role="switch"
          aria-checked={enabled}
          aria-label="Allow external AI analysis"
          disabled={busy}
          onClick={() => onChange(!enabled)}
          aria-describedby="external-analysis-description"
        >
          <span />
        </button>
      </div>
      <p id="external-analysis-description" className="analysis-setting-description">
        Optional analysis of your resume, skills, projects, preparation scores and practice answers
        by <strong>{destination}</strong>.
      </p>
      <details>
        <summary>What is shared & how to turn it off</summary>
        <p>
          <ShieldCheck size={12} /> Email addresses and phone numbers are removed from resume text
          and practice answers. Other identifying details may remain. Your skills, project summaries
          and preparation scores are also shared. Turn this off at any time to stop future requests;
          it does not remove data already sent. Built-in analysis works without sharing data with
          this service.
        </p>
      </details>
    </div>
  );
}

export function AnalysisSource({ status }: { status?: string }) {
  return (
    <span className="analysis-source">
      <ShieldCheck size={13} />
      {status === 'remote' ? 'External model analysis' : 'Built-in analysis'}
      {status && !['remote', 'consent-required', 'not-configured'].includes(status)
        ? ' · External insights unavailable'
        : ''}
    </span>
  );
}
