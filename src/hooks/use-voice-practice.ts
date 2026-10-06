'use client';
import { useEffect, useRef, useState } from 'react';
import { createVoiceSession, type VoiceRecognitionConstructor } from '@/utils/voice-recognition';

export function useVoicePractice() {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'listening' | 'stopping'>('idle');
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [voiceSeconds, setVoiceSeconds] = useState<number | null>(null);
  const [error, setError] = useState('');
  const constructor = useRef<VoiceRecognitionConstructor | null>(null);
  const session = useRef<ReturnType<typeof createVoiceSession> | null>(null);
  const began = useRef(0);
  const stopped = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const shutdown = useRef<ReturnType<typeof setTimeout> | null>(null);
  function clearTimers() {
    if (timer.current) clearInterval(timer.current);
    if (shutdown.current) clearTimeout(shutdown.current);
    timer.current = shutdown.current = null;
  }
  useEffect(() => {
    const browser = window as Window & {
      SpeechRecognition?: VoiceRecognitionConstructor;
      webkitSpeechRecognition?: VoiceRecognitionConstructor;
    };
    constructor.current = browser.SpeechRecognition || browser.webkitSpeechRecognition || null;
    setSupported(Boolean(constructor.current) && window.isSecureContext);
    return () => {
      clearTimers();
      session.current?.dispose();
    };
  }, []);

  function finish() {
    const duration = began.current
      ? Math.min(180, ((stopped.current || Date.now()) - began.current) / 1000)
      : 0;
    setVoiceSeconds(duration >= 1 ? duration : null);
    setSeconds(Math.floor(duration));
    setStatus('idle');
    setInterim('');
    clearTimers();
    session.current?.dispose();
    session.current = null;
  }
  function stop() {
    if (!session.current) return;
    stopped.current = Date.now();
    setStatus('stopping');
    if (timer.current) clearInterval(timer.current);
    if (shutdown.current) clearTimeout(shutdown.current);
    shutdown.current = setTimeout(finish, 5000);
    try {
      session.current.stop();
    } catch {
      finish();
    }
  }
  function start() {
    if (!constructor.current || status !== 'idle') return;
    clearTimers();
    session.current?.dispose();
    setError('');
    setTranscript('');
    setInterim('');
    setSeconds(0);
    setVoiceSeconds(null);
    began.current = 0;
    stopped.current = 0;
    setStatus('requesting');
    session.current = createVoiceSession(new constructor.current(), {
      started: () => {
        began.current = Date.now();
        if (shutdown.current) clearTimeout(shutdown.current);
        setStatus('listening');
        timer.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - began.current) / 1000);
          setSeconds(Math.min(180, elapsed));
          if (elapsed >= 180) stop();
        }, 250);
      },
      ended: finish,
      result: (final, pending) => {
        setTranscript(final.slice(0, 6000));
        setInterim(pending);
      },
      error: (message) => {
        setError(message);
        finish();
      },
    });
    shutdown.current = setTimeout(() => {
      setError('The microphone did not start. Check browser permissions or type your response.');
      finish();
    }, 20000);
    try {
      session.current.start();
    } catch {
      setError('Unable to start the microphone. Check permissions or type your response.');
      finish();
    }
  }
  function edit(text: string) {
    setTranscript(text);
    setVoiceSeconds(null);
    setError('');
  }
  function reset() {
    clearTimers();
    session.current?.dispose();
    session.current = null;
    began.current = 0;
    setStatus('idle');
    setTranscript('');
    setInterim('');
    setSeconds(0);
    setVoiceSeconds(null);
    setError('');
  }
  return {
    supported,
    status,
    transcript,
    interim,
    seconds,
    voiceSeconds,
    error,
    start,
    stop,
    edit,
    reset,
    active: status !== 'idle',
  };
}
