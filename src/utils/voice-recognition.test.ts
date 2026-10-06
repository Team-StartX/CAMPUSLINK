import { describe, expect, it, vi } from 'vitest';
import { createVoiceSession, type VoiceRecognition, type VoiceResult } from './voice-recognition';

function setup() {
  const recognition: VoiceRecognition = {
    continuous: false,
    interimResults: false,
    lang: '',
    onstart: null,
    onend: null,
    onresult: null,
    onerror: null,
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
  };
  const callbacks = { started: vi.fn(), ended: vi.fn(), result: vi.fn(), error: vi.fn() };
  return { recognition, callbacks, session: createVoiceSession(recognition, callbacks) };
}
const result = (transcript: string, isFinal: boolean): VoiceResult => ({
  isFinal,
  0: { transcript },
});
describe('voice recognition lifecycle', () => {
  it('replaces interim words and avoids duplicate final transcript on repeated events', () => {
    const { recognition, callbacks } = setup();
    recognition.onresult!({ results: [result('I built', true), result('a pro', false)] });
    expect(callbacks.result).toHaveBeenLastCalledWith('I built', 'a pro');
    recognition.onresult!({ results: [result('I built', true), result('a project', true)] });
    recognition.onresult!({ results: [result('I built', true), result('a project', true)] });
    expect(callbacks.result).toHaveBeenLastCalledWith('I built a project', '');
  });
  it('keeps final-result handlers active during stop so the last phrase is preserved', () => {
    const { recognition, callbacks, session } = setup();
    session.stop();
    recognition.onresult!({ results: [result('the final phrase', true)] });
    expect(recognition.stop).toHaveBeenCalledOnce();
    expect(callbacks.result).toHaveBeenCalledWith('the final phrase', '');
  });
  it('detaches handlers before aborting so unmount cannot update the transcript', () => {
    const { recognition, session } = setup();
    session.dispose();
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(recognition.onresult).toBeNull();
    expect(recognition.onerror).toBeNull();
    expect(recognition.onend).toBeNull();
  });
  it('reports denied permission and ignores an intentional abort', () => {
    const { recognition, callbacks } = setup();
    recognition.onerror!({ error: 'not-allowed' });
    expect(callbacks.error).toHaveBeenCalledWith(expect.stringContaining('denied'));
    recognition.onerror!({ error: 'aborted' });
    expect(callbacks.error).toHaveBeenCalledOnce();
  });
});
