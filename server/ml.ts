import fs from 'node:fs';
import { config } from './config';
export interface OutcomeRow {
  cohort: string;
  verifiedSkills: number;
  academics: number;
  projects: number;
  aptitude: number;
  communication: number;
  interview: number;
  placed: number;
}
export const features = [
  'verifiedSkills',
  'academics',
  'projects',
  'aptitude',
  'communication',
  'interview',
] as const;
export interface Model {
  version: string;
  provenance: 'synthetic' | 'historical';
  trainedAt: string;
  weights: number[];
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    brier: number;
    testCount: number;
    trainCount: number;
  };
  trainingCohorts: string[];
  testCohorts: string[];
}
const sigmoid = (x: number) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, x))));
const vector = (row: OutcomeRow) => [1, ...features.map((f) => row[f] / 100)];
export function predict(model: Model, row: OutcomeRow) {
  return sigmoid(vector(row).reduce((s, x, i) => s + x * model.weights[i], 0));
}
export function train(rows: OutcomeRow[], provenance: Model['provenance']): Model {
  const cohorts = [...new Set(rows.map((r) => r.cohort))].sort();
  if (cohorts.length < 3 || rows.length < 60)
    throw new Error(
      'Use at least 60 labelled rows across three cohorts; the latest cohort is held out.',
    );
  const testCohorts = [cohorts[cohorts.length - 1]],
    trainingCohorts = cohorts.slice(0, -1);
  const training = rows.filter((r) => trainingCohorts.includes(r.cohort)),
    test = rows.filter((r) => testCohorts.includes(r.cohort));
  if (
    new Set(training.map((r) => r.placed)).size < 2 ||
    new Set(test.map((r) => r.placed)).size < 2
  )
    throw new Error('Training and held-out sets both need placed and unplaced outcomes.');
  const weights = Array(7).fill(0);
  for (let epoch = 0; epoch < 1800; epoch++) {
    const gradient = Array(7).fill(0);
    for (const row of training) {
      const x = vector(row),
        error = sigmoid(x.reduce((s, v, i) => s + v * weights[i], 0)) - row.placed;
      x.forEach((v, i) => (gradient[i] += error * v));
    }
    weights.forEach(
      (w, i) => (weights[i] -= 0.15 * (gradient[i] / training.length + (i ? 0.01 * w : 0))),
    );
  }
  const model: Model = {
    version: 'logistic-v1',
    provenance,
    trainedAt: new Date().toISOString(),
    weights,
    trainingCohorts,
    testCohorts,
    metrics: {
      accuracy: 0,
      precision: 0,
      recall: 0,
      brier: 0,
      testCount: test.length,
      trainCount: training.length,
    },
  };
  let tp = 0,
    tn = 0,
    fp = 0,
    fn = 0,
    brier = 0;
  for (const row of test) {
    const p = predict(model, row);
    brier += (p - row.placed) ** 2;
    if (p >= 0.5) {
      if (row.placed) tp++;
      else fp++;
    } else if (row.placed) fn++;
    else tn++;
  }
  model.metrics = {
    accuracy: (tp + tn) / test.length,
    precision: tp / Math.max(1, tp + fp),
    recall: tp / Math.max(1, tp + fn),
    brier: brier / test.length,
    testCount: test.length,
    trainCount: training.length,
  };
  return model;
}
export function loadModel(): Model | undefined {
  try {
    return JSON.parse(fs.readFileSync(config.modelPath, 'utf8'));
  } catch {
    return undefined;
  }
}
export function modelInsight(row: OutcomeRow) {
  const model = loadModel();
  if (!model)
    return {
      available: false,
      label: 'Historical outcome model not trained',
      reason: 'Provide labelled historical outcomes to train and evaluate the model.',
    };
  if (config.production && model.provenance === 'synthetic')
    return {
      available: false,
      label: 'Historical outcome model not trained',
      reason: 'Synthetic models are disabled for production predictions.',
    };
  return {
    available: true,
    label:
      model.provenance === 'synthetic'
        ? 'Synthetic model demonstration'
        : 'Historical model estimate',
    probability: Math.round(predict(model, row) * 100),
    provenance: model.provenance,
    metrics: model.metrics,
    factors: features.map((name, i) => ({
      name,
      contribution: Math.round(model.weights[i + 1] * (row[name] / 100) * 100) / 100,
    })),
    limitation:
      'An association from training data, not a guarantee or an automated hiring decision.',
  };
}
