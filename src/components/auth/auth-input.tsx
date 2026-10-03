'use client';
import { Eye, EyeOff } from 'lucide-react';
import type { ComponentPropsWithRef } from 'react';
type Props = {
  id: string;
  label: string;
  error?: string;
  inputProps: ComponentPropsWithRef<'input'>;
};
export function AuthInput({ id, label, error, inputProps }: Props) {
  return (
    <div className="form-field auth-input">
      <label htmlFor={id}>{label}</label>
      <input
        {...inputProps}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <small id={`${id}-error`} className="field-error">
          {error}
        </small>
      )}
    </div>
  );
}
export function PasswordInput({
  id,
  label,
  error,
  inputProps,
  visible,
  onToggle,
  onToggleFocus,
  onToggleBlur,
}: Props & {
  visible: boolean;
  onToggle: () => void;
  onToggleFocus?: () => void;
  onToggleBlur?: () => void;
}) {
  return (
    <div className="form-field auth-input">
      <label htmlFor={id}>{label}</label>
      <div className="password-field">
        <input
          {...inputProps}
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-controls={id}
          aria-pressed={visible}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onToggle}
          onFocus={onToggleFocus}
          onBlur={onToggleBlur}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && (
        <small id={`${id}-error`} className="field-error">
          {error}
        </small>
      )}
    </div>
  );
}
