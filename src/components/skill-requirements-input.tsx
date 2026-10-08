'use client';

import { useId } from 'react';
import { skillNames } from '@/utils/skills';

export function SkillRequirementsInput({
  value,
  onChange,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const hint = useId();
  const names = skillNames(value);
  return (
    <>
      <textarea
        required={required}
        rows={2}
        maxLength={1000}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onChange(names.join(', '))}
        placeholder="React, Node.js, SQL"
        aria-describedby={hint}
      />
      <p id={hint} className="muted">
        Enter skill names separated by commas or new lines. These skills are compared with student
        profiles.
      </p>
      <div className="job-chips">
        {names.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
    </>
  );
}
