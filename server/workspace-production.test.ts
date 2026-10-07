import { describe, expect, it } from 'vitest';
import { emptyWorkspace } from './workspace';
import { defaultDrive } from '../src/services/drive.defaults';
import { modelInsight } from './ml';
import { config } from './config';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('real workspace defaults', () => {
  it('starts without invented contests, outcomes, or academic attributes', () => {
    const workspace = emptyWorkspace();
    expect(workspace.student).toMatchObject({
      course: '',
      branch: '',
      year: '',
      skills: [],
      projects: [],
      xp: 0,
    });
    for (const key of ['contests', 'drives', 'applications', 'offers', 'history'] as const)
      expect(workspace[key]).toEqual([]);
    expect(defaultDrive()).toMatchObject({
      company: '',
      campusId: '',
      role: '',
      deadline: '',
      preferredDates: [],
    });
  });
  it('rejects synthetic model inference even during local development', () => {
    const dir = mkdtempSync(join(tmpdir(), 'campuslink-model-'));
    const original = config.modelPath;
    try {
      config.modelPath = join(dir, 'model.json');
      writeFileSync(config.modelPath, JSON.stringify({ provenance: 'synthetic' }));
      expect(
        modelInsight({
          cohort: '2026',
          verifiedSkills: 80,
          academics: 80,
          projects: 80,
          aptitude: 80,
          communication: 80,
          interview: 80,
          placed: 0,
        }).available,
      ).toBe(false);
    } finally {
      config.modelPath = original;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
