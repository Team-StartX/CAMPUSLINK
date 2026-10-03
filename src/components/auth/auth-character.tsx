'use client';
import dynamic from 'next/dynamic';
import {
  Component,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useHydratedReducedMotion } from '@/hooks/use-hydrated-reduced-motion';
import { AUTH_RIVE_ENABLED } from './character-config';
import { CharacterIllustration } from './character-illustration';
export type AuthCharacterProps = {
  emailFocused: boolean;
  typing: boolean;
  passwordFocused: boolean;
  passwordVisible: boolean;
  success: boolean;
  error: boolean;
};
class AnimationBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
const RiveCharacter = dynamic(() => import('./rive-character'), { ssr: false });
export const AuthCharacter = memo(function AuthCharacter(props: AuthCharacterProps) {
  const reducedMotion = useHydratedReducedMotion();
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => setFailed(true), []);
  const useRive = AUTH_RIVE_ENABLED && !failed && !reducedMotion;
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = container.current;
    if (
      useRive ||
      reducedMotion ||
      props.typing ||
      props.passwordFocused ||
      props.error ||
      props.success
    )
      return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const x = Math.max(-1, Math.min(1, (event.clientX / window.innerWidth) * 2 - 1));
      const y = Math.max(-1, Math.min(1, (event.clientY / window.innerHeight) * 2 - 1));
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        element?.style.setProperty('--look-x', `${x * 3}px`);
        element?.style.setProperty('--look-y', `${y * 2}px`);
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      cancelAnimationFrame(frame);
      element?.style.setProperty('--look-x', '0px');
      element?.style.setProperty('--look-y', '0px');
    };
  }, [useRive, reducedMotion, props.typing, props.passwordFocused, props.error, props.success]);
  const state = props.success
    ? 'success'
    : props.error
      ? 'error'
      : props.passwordFocused
        ? props.passwordVisible
          ? 'peek'
          : 'covered'
        : props.typing
          ? 'typing'
          : props.emailFocused
            ? 'focused'
            : 'idle';
  return (
    <div
      ref={container}
      className="auth-character"
      style={{ '--look-x': '0px', '--look-y': '0px' } as CSSProperties}
      data-state={state}
      data-reduced-motion={reducedMotion}
      aria-hidden="true"
    >
      {(!useRive || !ready) && <CharacterIllustration />}
      {useRive && (
        <AnimationBoundary onFailure={onFailure}>
          <RiveCharacter {...props} onReady={onReady} onFailure={onFailure} />
        </AnimationBoundary>
      )}
    </div>
  );
});
