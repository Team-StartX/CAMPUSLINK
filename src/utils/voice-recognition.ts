export interface VoiceResult {
  isFinal: boolean;
  0: { transcript: string };
}
export interface VoiceResultEvent {
  results: ArrayLike<VoiceResult>;
}
export interface VoiceRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: VoiceResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type VoiceRecognitionConstructor = new () => VoiceRecognition;

export function createVoiceSession(
  recognition: VoiceRecognition,
  callbacks: {
    started: () => void;
    ended: () => void;
    result: (final: string, interim: string) => void;
    error: (message: string) => void;
  },
) {
  const finals = new Map<number, string>();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-IN';
  recognition.onstart = callbacks.started;
  recognition.onend = callbacks.ended;
  recognition.onresult = (event) => {
    const interim: string[] = [];
    for (let index = 0; index < event.results.length; index++) {
      const result = event.results[index];
      if (result.isFinal) finals.set(index, result[0].transcript.trim());
      else interim.push(result[0].transcript);
    }
    callbacks.result(
      [...finals.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, text]) => text)
        .join(' '),
      interim.join(' '),
    );
  };
  recognition.onerror = ({ error }) => {
    const messages: Record<string, string> = {
      'not-allowed':
        'Microphone access was denied. Allow it in your browser, or type your response below.',
      'service-not-allowed':
        'Your browser has blocked speech recognition. You can type your response instead.',
      'audio-capture': 'No microphone was found. Check your microphone connection and try again.',
      'no-speech':
        'No speech was recognized. Try speaking closer to your microphone, or type your response.',
      network:
        'Speech recognition could not connect. Check your connection, or type your response.',
      'language-not-supported':
        'English speech recognition is unavailable in this browser. Try another browser or type your response.',
    };
    if (error !== 'aborted')
      callbacks.error(
        messages[error] || 'Speech recognition stopped. Try another take, or type your response.',
      );
  };
  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    dispose: () => {
      recognition.onstart = recognition.onend = recognition.onresult = recognition.onerror = null;
      recognition.abort();
    },
  };
}
