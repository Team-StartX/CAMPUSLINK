import { describe, expect, it } from 'vitest';
import {
  analyzeCommunication,
  communicationInputSchema,
  type CommunicationInput,
} from './communication';

const input = (
  transcript: string,
  extra: Partial<CommunicationInput> = {},
): CommunicationInput => ({
  promptId: 'project',
  transcript,
  mode: 'text',
  seconds: null,
  ...extra,
});
describe('communication transcript feedback', () => {
  it('returns exact evidence and a correction for narrow grammar patterns', () => {
    const feedback = analyzeCommunication(
      input(
        "I am agree that we should discuss about the project because I didn't knew the result.",
      ),
    );
    expect(feedback.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'Grammar', quote: 'I am agree', correction: 'I agree' }),
        expect.objectContaining({ quote: 'discuss about', correction: 'discuss' }),
        expect.objectContaining({ quote: "didn't knew", correction: "didn't know" }),
      ]),
    );
  });
  it('does not flag correct subject agreement or words containing filler substrings', () => {
    const feedback = analyzeCommunication(
      input('We have built a unique project because the outcome improved our teamwork overall.'),
    );
    expect(feedback.issues.filter((issue) => issue.kind === 'Grammar')).toEqual([]);
    expect(feedback.metrics.fillers).toBe(0);
    expect(feedback.strengths.length).toBeGreaterThan(1);
  });
  it('counts filler phrases and flags a repeated word without duplicating it', () => {
    const feedback = analyzeCommunication(
      input('Um I I built a project and uh you know the result was better overall.'),
    );
    expect(feedback.metrics.fillers).toBe(3);
    expect(feedback.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'Repetition', quote: 'I I', correction: 'I' }),
      ]),
    );
  });
  it('estimates pace only for a sufficiently long unedited voice take', () => {
    const transcript = Array(30).fill('practice').join(' ');
    expect(
      analyzeCommunication(input(transcript, { mode: 'voice', seconds: 15 })).metrics
        .wordsPerMinute,
    ).toBe(120);
    expect(analyzeCommunication(input(transcript)).metrics.wordsPerMinute).toBeNull();
    expect(
      analyzeCommunication(input(transcript, { mode: 'voice', seconds: 10 })).metrics
        .wordsPerMinute,
    ).toBeNull();
    expect(
      analyzeCommunication(input('I built a project', { mode: 'voice', seconds: 20 })).metrics
        .wordsPerMinute,
    ).toBeNull();
  });
  it('bounds input and rejects forged typed-response timing', () => {
    const transcript = 'I built a project because I wanted to improve our teamwork.';
    expect(communicationInputSchema.safeParse(input(transcript)).success).toBe(true);
    expect(communicationInputSchema.safeParse(input(transcript, { seconds: 20 })).success).toBe(
      false,
    );
    expect(
      communicationInputSchema.safeParse(input(transcript, { mode: 'voice', seconds: 200 }))
        .success,
    ).toBe(false);
    expect(communicationInputSchema.safeParse(input('Too short')).success).toBe(false);
    expect(communicationInputSchema.safeParse(input('word '.repeat(1500))).success).toBe(false);
  });
});
