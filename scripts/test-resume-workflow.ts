import assert from 'node:assert/strict';
import { Database } from '../server/db';
import type { Account } from '../server/auth';
import { runWorkspace, emptyWorkspace } from '../server/workspace';
import { dispatch } from '../server/services';
import { coaching } from '../server/generative';
import { config } from '../server/config';
import { skillPractice } from '../server/skill-practice';
import type { SkillPractice } from '../src/types/resume';
import type { WorkspaceData } from '../src/types';

async function main() {
  const db = new Database('', ':memory:');
  const originalFetch = globalThis.fetch;
  const previous = { ai: config.ai, aiKey: config.aiKey, geminiKey: config.geminiKey };
  const actor: Account = {
    id: 'resume-test',
    email: 'resume@example.test',
    name: 'Sample Student',
    role: 'student',
    campusId: 'test-campus',
    organization: 'Test',
    approved: true,
    verified: true,
    passwordHash: '',
    createdAt: new Date().toISOString(),
    aiConsent: false,
  };
  const call = (service: string, method: string, args: unknown[] = []) =>
    runWorkspace(db, actor, undefined, () => dispatch(service, method, args));
  try {
    await db.migrate();
    await db.put('account', actor.email, actor, actor.campusId, actor.id);
    await db.put('workspace', actor.id, emptyWorkspace(actor), actor.campusId, actor.id);
    config.ai = 'openai';
    config.aiKey = 'test-only';
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new Error('No network allowed in this test');
    };
    await assert.rejects(() => call('aiService', 'getSkillPractice', ['React']), /Add this skill/);
    await call('studentService', 'addSkill', ['React', 'Beginner']);
    let data = (await call('studentService', 'getDashboard')) as WorkspaceData;
    assert.equal(data.student.skills.length, 1);
    assert.equal(data.student.skills[0].verified, false);
    assert.ok(data.assessments.some((a) => a.skill === 'React'));
    await assert.rejects(
      () => call('studentService', 'addSkill', ['reactjs', 'Beginner']),
      /already/,
    );
    const fallback = (await call('aiService', 'getSkillPractice', ['reactjs'])) as SkillPractice;
    assert.equal(fallback.source, 'built-in');
    assert.equal(fallback.questions.length, 3);
    assert.equal(calls, 0, 'No requests without student consent');
    const questions = Array.from({ length: 3 }, (_, i) => ({
      prompt: `React technical practice question ${i + 1}?`,
      checkpoints: ['Explain the concept.', 'Give a working example.'],
    }));
    globalThis.fetch = async (_url, options) => {
      calls++;
      const body = JSON.parse(String(options?.body));
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      assert.deepEqual(JSON.parse(body.input), { skill: 'React', level: 'Beginner' });
      return new Response(
        JSON.stringify({
          output: [{ content: [{ type: 'output_text', text: JSON.stringify({ questions }) }] }],
        }),
        { status: 200 },
      );
    };
    actor.aiConsent = true;
    const generated = (await call('aiService', 'getSkillPractice', ['React'])) as SkillPractice;
    assert.equal(generated.source, 'openai');
    assert.equal(calls, 1);
    globalThis.fetch = async () => new Response('{}', { status: 200 });
    assert.equal((await skillPractice('React', 'Beginner', true)).source, 'built-in');
    globalThis.fetch = async () => new Response('', { status: 401 });
    assert.equal((await skillPractice('React', 'Beginner', true)).source, 'built-in');
    config.ai = 'gemini';
    config.geminiKey = 'gemini-test-only';
    const beforeGemini = calls;
    globalThis.fetch = async () => {
      calls++;
      throw new Error('Consent required');
    };
    assert.equal(
      ((await call('aiService', 'getSkillPractice', ['React'])) as SkillPractice).source,
      'built-in',
    );
    assert.equal(calls, beforeGemini, 'OpenAI consent must not authorize Gemini');
    actor.aiConsentProvider = 'gemini';
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.ok(String(url).startsWith('https://generativelanguage.googleapis.com/'));
      assert.ok(!String(url).includes('gemini-test-only'));
      assert.equal(new Headers(options?.headers).get('x-goog-api-key'), 'gemini-test-only');
      const body = JSON.parse(String(options?.body));
      assert.equal(body.store, false);
      assert.equal(body.generationConfig.responseMimeType, 'application/json');
      assert.ok(body.generationConfig.maxOutputTokens <= 4096);
      assert.ok(body.generationConfig.responseJsonSchema.required.length);
      assert.ok(!body.contents[0].parts[0].text.includes('private@example.com'));
      const output = body.generationConfig.responseJsonSchema.properties.questions
        ? { questions }
        : { suggestions: ['Practice React hooks.'], summary: 'Keep practicing.' };
      return Response.json({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                { thought: true, text: 'Ignore internal thoughts' },
                { text: JSON.stringify(output) },
              ],
            },
          },
        ],
      });
    };
    assert.equal(
      ((await call('aiService', 'getSkillPractice', ['React'])) as SkillPractice).source,
      'gemini',
    );
    assert.equal(
      (await coaching('resume', { email: 'private@example.com' }, true))?.summary,
      'Keep practicing.',
    );
    const beforeNoConsent = calls;
    assert.equal(await coaching('resume', {}, false), undefined);
    assert.equal(calls, beforeNoConsent);
    for (const payload of [
      {},
      { candidates: [{ finishReason: 'MAX_TOKENS' }] },
      { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{}' }] } }] },
    ]) {
      globalThis.fetch = async () => Response.json(payload);
      assert.equal((await skillPractice('React', 'Beginner', true)).source, 'built-in');
    }
    globalThis.fetch = async () => new Response('', { status: 429 });
    assert.equal((await skillPractice('React', 'Beginner', true)).source, 'built-in');
    globalThis.fetch = async () => {
      throw new DOMException('Timed out', 'TimeoutError');
    };
    assert.equal((await skillPractice('React', 'Beginner', true)).source, 'built-in');
    config.geminiKey = '';
    const beforeMissingKey = calls;
    assert.equal((await skillPractice('React', 'Beginner', true)).source, 'built-in');
    assert.equal(calls, beforeMissingKey);
    data = (await call('studentService', 'getDashboard')) as WorkspaceData;
    assert.equal(data.student.skills[0].verified, false, 'Practice never verifies a skill');
    assert.equal(data.student.xp, 0, 'Practice never awards XP');
    actor.role = 'recruiter';
    await assert.rejects(() => call('aiService', 'getSkillPractice', ['React']), /role cannot/);
    console.log(
      'PASS: skill persistence, duplicate prevention, role checks, consent, generated questions, provider failure, unchanged verification and XP.',
    );
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(config, previous);
    await db.close();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
