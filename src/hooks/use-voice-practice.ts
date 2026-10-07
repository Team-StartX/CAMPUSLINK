'use client';
import { apiClient } from '@/services/api/client';
import { setCsrf } from '@/services/api/remote';
import { useEffect, useRef, useState } from 'react';

export function useVoicePractice() {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'listening' | 'stopping'>('idle');
  const [transcript, setTranscript] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [voiceSeconds, setVoiceSeconds] = useState<number | null>(null);
  const [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const generation = useRef(0);
  const active = useRef(false);
  const request = useRef<AbortController | null>(null);
  function release() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }
  function cancel() {
    generation.current++;
    active.current = false;
    request.current?.abort();
    if (recorder.current) {
      recorder.current.onstop = null;
      recorder.current.ondataavailable = null;
      recorder.current.onerror = null;
      if (recorder.current.state !== 'inactive') recorder.current.stop();
      recorder.current = null;
    }
    release();
  }
  useEffect(() => {
    let mounted = true;
    if (window.isSecureContext && navigator.mediaDevices && typeof MediaRecorder !== 'undefined') {
      void apiClient
        .get('/voice/capabilities')
        .then(({ data }) => {
          if (mounted) setSupported(data.available === true);
        })
        .catch(() => {
          if (mounted) setSupported(false);
        });
    }
    return () => {
      mounted = false;
      cancel();
    };
    // Resource refs handle cancellation independently of rendered state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function stop() {
    if (active.current && !recorder.current) {
      cancel();
      setStatus('idle');
      return;
    }
    if (!active.current || !recorder.current || recorder.current.state !== 'recording') return;
    setStatus('stopping');
    if (timer.current) clearInterval(timer.current);
    recorder.current.stop();
    release();
  }
  async function start() {
    if (!supported || active.current) return;
    active.current = true;
    const take = ++generation.current;
    setError('');
    setStatus('requesting');
    setSeconds(0);
    setVoiceSeconds(null);
    try {
      const { data } = await apiClient.get('/auth/me');
      if (generation.current !== take) return;
      setCsrf(data.csrf);
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation.current !== take) {
        audioStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = audioStream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(
        (mime) => MediaRecorder.isTypeSupported(mime),
      );
      const recording = new MediaRecorder(audioStream, mimeType ? { mimeType } : undefined);
      recorder.current = recording;
      const chunks: Blob[] = [];
      let bytes = 0;
      const began = Date.now();
      recording.ondataavailable = ({ data: chunk }) => {
        if (generation.current !== take || !chunk.size) return;
        chunks.push(chunk);
        bytes += chunk.size;
        if (bytes > 11 * 1024 * 1024 && recording.state === 'recording') stop();
      };
      recording.onerror = () => {
        if (generation.current !== take) return;
        cancel();
        setStatus('idle');
        setError('Audio recording failed. Check microphone permissions and try again.');
      };
      recording.onstop = async () => {
        release();
        if (generation.current !== take) return;
        setStatus('stopping');
        const duration = Math.min(180, (Date.now() - began) / 1000);
        const audio = new Blob(chunks, { type: recording.mimeType });
        if (!audio.size || duration < 1) {
          active.current = false;
          setStatus('idle');
          setError('Record at least one second of speech before stopping.');
          return;
        }
        const form = new FormData();
        form.append('file', audio, 'practice-audio');
        form.append('consent', 'true');
        const controller = new AbortController();
        request.current = controller;
        try {
          const { data: result } = await apiClient.post('/voice/transcriptions', form, {
            timeout: 60000,
            signal: controller.signal,
          });
          if (generation.current !== take) return;
          setTranscript(result.text);
          setVoiceSeconds(duration);
          setSeconds(Math.floor(duration));
        } catch (failure) {
          if (generation.current === take)
            setError(
              failure instanceof Error
                ? failure.message
                : 'Could not transcribe your recording. Please try again.',
            );
        } finally {
          if (generation.current === take) {
            active.current = false;
            recorder.current = null;
            setStatus('idle');
          }
        }
      };
      recording.start(1000);
      setStatus('listening');
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - began) / 1000);
        setSeconds(Math.min(180, elapsed));
        if (elapsed >= 180) stop();
      }, 250);
    } catch (failure) {
      if (generation.current !== take) return;
      cancel();
      setStatus('idle');
      setError(
        failure instanceof DOMException && failure.name === 'NotAllowedError'
          ? 'Microphone access was denied. Allow it in your browser or type a response.'
          : 'Unable to start recording. Check your microphone and try again.',
      );
    }
  }
  function edit(text: string) {
    setTranscript(text);
    setVoiceSeconds(null);
    setError('');
  }
  function reset() {
    cancel();
    setStatus('idle');
    setTranscript('');
    setSeconds(0);
    setVoiceSeconds(null);
    setError('');
  }
  return {
    supported,
    status,
    transcript,
    interim: '',
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
