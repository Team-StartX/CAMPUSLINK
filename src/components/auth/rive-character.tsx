'use client';
import { useEffect } from 'react';
import { Alignment, Fit, Layout, useRive, useStateMachineInput } from '@rive-app/react-canvas';
import { AUTH_RIVE_SRC, AUTH_STATE_MACHINE } from './character-config';
import type { AuthCharacterProps } from './auth-character';
const layout = new Layout({ fit: Fit.Contain, alignment: Alignment.Center });
export default function RiveCharacter(
  props: AuthCharacterProps & { onReady: () => void; onFailure: () => void },
) {
  const { onReady, onFailure } = props;
  const { rive, RiveComponent } = useRive({
    src: AUTH_RIVE_SRC,
    stateMachines: AUTH_STATE_MACHINE,
    autoplay: true,
    layout,
    onLoadError: onFailure,
  });
  const email = useStateMachineInput(rive, AUTH_STATE_MACHINE, 'isEmailFocused');
  const typing = useStateMachineInput(rive, AUTH_STATE_MACHINE, 'isTyping');
  const password = useStateMachineInput(rive, AUTH_STATE_MACHINE, 'isPasswordFocused');
  const visible = useStateMachineInput(rive, AUTH_STATE_MACHINE, 'isPasswordVisible');
  const success = useStateMachineInput(rive, AUTH_STATE_MACHINE, 'isSuccess');
  const error = useStateMachineInput(rive, AUTH_STATE_MACHINE, 'isError');
  const available = (name: string) =>
    rive?.stateMachineInputs(AUTH_STATE_MACHINE)?.some((input) => input.name === name)
      ? rive
      : null;
  const mouseX = useStateMachineInput(available('mouseX'), AUTH_STATE_MACHINE, 'mouseX');
  const mouseY = useStateMachineInput(available('mouseY'), AUTH_STATE_MACHINE, 'mouseY');
  useEffect(() => {
    if (props.typing || props.passwordFocused || props.error || props.success) return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (mouseX && typeof mouseX.value === 'number')
          mouseX.value = Math.max(-1, Math.min(1, (event.clientX / window.innerWidth) * 2 - 1));
        if (mouseY && typeof mouseY.value === 'number')
          mouseY.value = Math.max(-1, Math.min(1, (event.clientY / window.innerHeight) * 2 - 1));
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      cancelAnimationFrame(frame);
      if (mouseX && typeof mouseX.value === 'number') mouseX.value = 0;
      if (mouseY && typeof mouseY.value === 'number') mouseY.value = 0;
    };
  }, [mouseX, mouseY, props.typing, props.passwordFocused, props.error, props.success]);
  useEffect(() => {
    if (!rive) return;
    const inputs = rive.stateMachineInputs(AUTH_STATE_MACHINE) || [];
    if (
      ![
        'isEmailFocused',
        'isTyping',
        'isPasswordFocused',
        'isPasswordVisible',
        'isSuccess',
        'isError',
      ].every((name) =>
        inputs.some((input) => input.name === name && typeof input.value === 'boolean'),
      )
    ) {
      onFailure();
      return;
    }
    onReady();
  }, [rive, onFailure, onReady]);
  useEffect(() => {
    if (email) email.value = props.emailFocused;
    if (typing) typing.value = props.typing;
    if (password) password.value = props.passwordFocused;
    if (visible) visible.value = props.passwordVisible;
    if (success) success.value = props.success;
    if (error) error.value = props.error;
  }, [
    email,
    typing,
    password,
    visible,
    success,
    error,
    props.emailFocused,
    props.typing,
    props.passwordFocused,
    props.passwordVisible,
    props.success,
    props.error,
  ]);
  return <RiveComponent className="auth-rive-canvas" />;
}
