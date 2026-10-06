import { z } from 'zod';

export const communicationPrompts = [
  {
    id: 'introduction',
    title: 'Introduce yourself',
    question: 'Introduce yourself and describe what you would bring to a team.',
    hint: 'Start with your current focus, give one example of your work, and close with your next goal.',
  },
  {
    id: 'project',
    title: 'Explain a project',
    question: 'Explain a project you built, the challenge you faced, and the result.',
    hint: 'Describe the problem, your own contribution, and what changed because of your work.',
  },
  {
    id: 'teamwork',
    title: 'Talk about teamwork',
    question: 'Describe a time you resolved a disagreement or helped your team.',
    hint: 'Set the scene, explain how you listened and acted, and finish with the outcome.',
  },
  {
    id: 'opinion',
    title: 'Share an opinion',
    question: 'Should students work on group projects? Explain your view with an example.',
    hint: 'State your view, explain one reason, give an example, and summarize your point.',
  },
] as const;

export const communicationInputSchema = z
  .object({
    promptId: z.enum(['introduction', 'project', 'teamwork', 'opinion']),
    transcript: z
      .string()
      .trim()
      .min(20)
      .max(6000)
      .refine(
        (text) => (text.match(/\b[\w']+\b/g) || []).length >= 8,
        'Use at least eight words so feedback has enough context.',
      ),
    mode: z.enum(['voice', 'text']),
    seconds: z.number().min(1).max(180).nullable(),
  })
  .strict()
  .refine(
    (input) => input.mode !== 'text' || input.seconds === null,
    'Typed responses cannot have a speaking pace.',
  );

export type CommunicationInput = z.infer<typeof communicationInputSchema>;
export interface CommunicationIssue {
  kind: 'Grammar' | 'Filler words' | 'Repetition' | 'Structure';
  quote: string;
  correction: string;
  explanation: string;
}
export interface CommunicationFeedback {
  id: string;
  date: string;
  input: CommunicationInput;
  source: 'Transcript checks' | 'Transcript checks + AI coaching';
  metrics: { words: number; fillers: number; fillerPercent: number; wordsPerMinute: number | null };
  issues: CommunicationIssue[];
  strengths: string[];
  nextSteps: string[];
  coaching?: { summary: string; suggestions: string[] };
  coachingStatus: 'local' | 'available' | 'unavailable';
}

// These narrow patterns flag possible transcript errors, not pronunciation or accent.
const grammarRules = [
  {
    pattern: /\bI am agree\b/gi,
    correction: () => 'I agree',
    explanation: '“Agree” is already a verb; remove “am”.',
  },
  {
    pattern: /\b(he|she|it) (don't|do not)\b/gi,
    correction: (quote: string) => `${quote.split(' ')[0]} does not`,
    explanation: 'Use “does not” with he, she, or it.',
  },
  {
    pattern: /\b(I|you|we|they) has\b/gi,
    correction: (quote: string) => `${quote.split(' ')[0]} have`,
    explanation: 'Use “have” with I, you, we, or they.',
  },
  {
    pattern: /\b(didn't|did not) (went|knew|told|saw|done|made)\b/gi,
    correction: (quote: string) =>
      quote.replace(
        /(went|knew|told|saw|done|made)$/i,
        (verb) =>
          ({ went: 'go', knew: 'know', told: 'tell', saw: 'see', done: 'do', made: 'make' })[
            verb.toLowerCase()
          ]!,
      ),
    explanation: 'After “did not”, use the base form of the verb.',
  },
  {
    pattern: /\bmore better\b/gi,
    correction: () => 'better',
    explanation: '“Better” already expresses a comparison; remove “more”.',
  },
  {
    pattern: /\bdiscuss about\b/gi,
    correction: () => 'discuss',
    explanation: 'Say “discuss the topic” without “about”.',
  },
];

export function analyzeCommunication(
  input: CommunicationInput,
): Omit<CommunicationFeedback, 'id' | 'date'> {
  const { transcript } = input;
  const words = transcript.match(/\b[\w']+\b/g) || [];
  const fillers = [...transcript.matchAll(/\b(um+|uh+|erm|you know)\b/gi)];
  const issues: CommunicationIssue[] = [];
  for (const rule of grammarRules) {
    const matches = [...transcript.matchAll(new RegExp(rule.pattern))];
    for (const quote of [...new Set(matches.map((match) => match[0]))]) {
      issues.push({
        kind: 'Grammar',
        quote,
        correction: rule.correction(quote),
        explanation: rule.explanation,
      });
    }
  }
  if (fillers.length)
    issues.push({
      kind: 'Filler words',
      quote: [...new Set(fillers.map((match) => match[0].toLowerCase()))].join(', '),
      correction: 'Take a short silent pause before your next point.',
      explanation: `${fillers.length} filler phrase${fillers.length === 1 ? '' : 's'} appear in this transcript. Speech recognition can miss fillers.`,
    });
  for (const match of transcript.matchAll(/\b(I|we|you|the|a|and|so)\s+\1\b/gi)) {
    issues.push({
      kind: 'Repetition',
      quote: match[0],
      correction: match[1],
      explanation:
        'This word appears twice in a row. Check whether it was a restart or a transcription mistake.',
    });
  }
  const hasExample =
    /\b(for example|for instance|built|created|implemented|tested|resolved|project)\b/i.test(
      transcript,
    );
  const hasReason = /\b(because|therefore|so that|reason|first|then|however)\b/i.test(transcript);
  const hasOutcome =
    /\b(result|outcome|learned|learnt|improved|reduced|increased|finally|in conclusion|overall)\b/i.test(
      transcript,
    );
  if (!hasExample)
    issues.push({
      kind: 'Structure',
      quote: '',
      correction: 'Add one concrete example of what you did.',
      explanation:
        'An example helps the listener understand your point. These checks look for explicit example words.',
    });
  if (!hasOutcome)
    issues.push({
      kind: 'Structure',
      quote: '',
      correction: 'End with a result, lesson, or short takeaway.',
      explanation: 'A clear closing point makes your answer easier to follow.',
    });
  const strengths: string[] = [];
  if (hasExample) strengths.push('You included language that introduces a concrete example.');
  if (hasReason) strengths.push('You used connecting words to explain your reasoning or sequence.');
  if (hasOutcome) strengths.push('You included an outcome or takeaway.');
  if (!fillers.length) strengths.push('No common filler phrases were found in the transcript.');
  const wordsPerMinute =
    input.mode === 'voice' && input.seconds !== null && input.seconds >= 15 && words.length >= 20
      ? Math.round((words.length / input.seconds) * 60)
      : null;
  const nextSteps = [
    ...issues
      .slice(0, 3)
      .map((issue) =>
        issue.kind === 'Grammar'
          ? `Practice “${issue.correction}” in a complete sentence.`
          : issue.correction,
      ),
    ...(wordsPerMinute !== null && wordsPerMinute > 180
      ? ['Try slowing down and leaving a short pause between ideas.']
      : []),
    ...(wordsPerMinute !== null && wordsPerMinute < 90
      ? ['Try a shorter outline, then connect your ideas without long gaps.']
      : []),
    'Try the same prompt again in 60–90 seconds: main point, example, takeaway.',
  ];
  return {
    input,
    source: 'Transcript checks',
    metrics: {
      words: words.length,
      fillers: fillers.length,
      fillerPercent: Math.round((fillers.length / Math.max(1, words.length)) * 1000) / 10,
      wordsPerMinute,
    },
    issues: issues.slice(0, 20),
    strengths,
    nextSteps,
    coachingStatus: 'local',
  };
}
