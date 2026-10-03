const dictionary: Record<string, string[]> = {
  React: ['react', 'reactjs', 'react.js'],
  JavaScript: ['javascript', 'js', 'ecmascript'],
  TypeScript: ['typescript', 'ts'],
  'Node.js': ['node', 'nodejs', 'node.js'],
  Express: ['express', 'expressjs'],
  Python: ['python'],
  Java: ['java'],
  SQL: ['sql', 'postgresql', 'postgres', 'mysql'],
  MongoDB: ['mongodb', 'mongo'],
  AWS: ['aws', 'amazon web services'],
  Docker: ['docker', 'containerization'],
  Kubernetes: ['kubernetes', 'k8s'],
  Git: ['git', 'github'],
  DSA: ['dsa', 'data structures', 'algorithms'],
  HTML: ['html', 'html5'],
  CSS: ['css', 'css3'],
  'Machine Learning': ['machine learning', 'ml', 'scikit-learn', 'sklearn'],
  TensorFlow: ['tensorflow'],
  PyTorch: ['pytorch'],
  Excel: ['excel'],
  PowerBI: ['power bi', 'powerbi'],
  Communication: ['communication', 'presentation', 'public speaking'],
};
const boundary = (alias: string) =>
  new RegExp(`(?<![a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`, 'i');
export function extractSkills(text: string) {
  return Object.entries(dictionary)
    .filter(([, aliases]) => aliases.some((a) => boundary(a).test(text)))
    .map(([name]) => name);
}
export function parseRequirements(text: string) {
  const cgpa =
    text.match(/(?:cgpa|gpa)\s*(?:of|above|>=|≥|:|minimum)?\s*(\d(?:\.\d+)?)/i) ||
    text.match(/(\d(?:\.\d+)?)\s*(?:cgpa|gpa)/i);
  const branches = ['CSE', 'IT', 'ECE', 'EE', 'ME', 'Civil'].filter((b) => boundary(b).test(text));
  const years = [...new Set(text.match(/\b20[2-4]\d\b/g) || [])];
  return {
    label: 'Local NLP extraction',
    skills: extractSkills(text),
    cgpa: cgpa ? Math.min(10, Number(cgpa[1])) : null,
    branches,
    graduationYears: years,
    allowedBacklogs: /no\s+(?:active\s+)?backlogs?|zero\s+backlogs?/i.test(text) ? 0 : null,
    eligibility: 'Confirm the extracted criteria before submitting the drive.',
    reviewRequired: true,
  };
}
const stop = new Set(
  'the a an and or is are to of for with in on from as be this that have has it i we our your'.split(
    ' ',
  ),
);
export function tokens(text: string): string[] {
  let normalized = text.toLowerCase();
  for (const [name, aliases] of Object.entries(dictionary))
    for (const alias of aliases)
      normalized = normalized.replace(
        new RegExp(boundary(alias).source, 'gi'),
        ` ${name.toLowerCase().replace(/[^a-z]/g, '')} `,
      );
  return (normalized.match(/[a-z][a-z0-9]{1,}/g) || []).filter((w) => !stop.has(w));
}
export function similarity(query: string, documents: string[]) {
  const corpus = [query, ...documents].map(tokens);
  const vocabulary = [...new Set(corpus.flat())];
  const idf = new Map(
    vocabulary.map((w) => [
      w,
      Math.log((corpus.length + 1) / (1 + corpus.filter((d) => d.includes(w)).length)) + 1,
    ]),
  );
  const vectors = corpus.map(
    (d) =>
      new Map(
        vocabulary.map((w) => [
          w,
          (d.filter((t) => t === w).length / Math.max(1, d.length)) * idf.get(w)!,
        ]),
      ),
  );
  const norm = (v: Map<string, number>) =>
    Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0));
  return vectors.slice(1).map((v) => {
    const denominator = norm(vectors[0]) * norm(v);
    return denominator
      ? [...v].reduce((s, [w, x]) => s + x * (vectors[0].get(w) || 0), 0) / denominator
      : 0;
  });
}
export function analyzeResumeText(text: string) {
  const skills = extractSkills(text);
  const suggestions: string[] = [];
  if (!/\b\d+\s*(%|users|seconds|projects|clients|hours)\b/i.test(text))
    suggestions.push('Describe measurable project outcomes where you have evidence.');
  if (!/github|portfolio|linkedin/i.test(text))
    suggestions.push('Add a professional portfolio or project link.');
  if (!/project|experience|internship/i.test(text))
    suggestions.push('Include a project or experience section with your contribution.');
  if (text.trim().split(/\s+/).length < 120)
    suggestions.push('Add enough context to explain your work and responsibilities.');
  return {
    label: 'Local NLP resume analysis',
    skills,
    suggestions,
    wordCount: text.trim().split(/\s+/).length,
    reviewRequired: true,
  };
}
export function interviewFeedback(questions: string[], answers: string[]) {
  const count = Math.max(1, questions.length);
  const relevance = similarity(questions.join(' '), [answers.join(' ')])[0] * 100;
  const lengths =
    answers.reduce((s, a) => s + Math.min(100, a.trim().split(/\s+/).length * 2), 0) / count;
  const structure =
    (answers.filter((a) => /because|result|first|then|example|challenge|action/i.test(a)).length /
      count) *
    100;
  const evidence =
    (answers.filter((a) => /\d|implemented|built|tested|measured|resolved/i.test(a)).length /
      count) *
    100;
  return {
    label: 'Local text-analysis feedback',
    categories: [
      { name: 'Response detail', score: Math.round(lengths) },
      { name: 'Topic relevance', score: Math.round(Math.min(100, relevance * 2)) },
      { name: 'Structure', score: Math.round(structure) },
      { name: 'Specific evidence', score: Math.round(evidence) },
    ],
    advice:
      structure < 70
        ? 'Organize your answer around the situation, your action, and the result.'
        : 'Keep your examples specific and explain how you checked the outcome.',
    limitation:
      'Text heuristics are preparation guidance, not validated communication or hiring assessments.',
  };
}
