'use client';
import { AuthBrandPanel } from '@/components/auth/auth-brand-panel';
import { AuthInput, PasswordInput } from '@/components/auth/auth-input';
import { useAuthCharacterState } from '@/components/auth/use-auth-character';
import { OrganizationPicker } from '@/components/organization-picker';
import { Logo } from '@/components/public';
import { Button, FormField, Modal } from '@/components/ui';
import { apiClient } from '@/services/api/client';
import { authService } from '@/store/session';
import type { Campus } from '@/types';
import { Role } from '@/types';
import { authSchema } from '@/utils/auth-validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, BriefcaseBusiness, Building2, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
type Values = z.infer<ReturnType<typeof authSchema>>;
export function AuthPage({ registering = false }: { registering?: boolean }) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const router = useRouter();
  const client = useQueryClient();
  const {
    data: campuses,
    isLoading: campusesLoading,
    error: campusesError,
  } = useQuery<Campus[]>({
    queryKey: ['registration-campuses'],
    queryFn: async () => (await apiClient.get('/campuses')).data,
    enabled: registering,
    retry: false,
  });
  const [role, setRole] = useState<Role>('student');
  const [selected, setSelected] = useState(false);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('role');
    if (['student', 'recruiter', 'campus'].includes(requested || '')) {
      setRole(requested as Role);
      setSelected(true);
    }
  }, [registering]);
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const character = useAuthCharacterState(loading);
  const resetCharacter = character.reset;
  useEffect(() => {
    resetCharacter();
  }, [registering, resetCharacter]);
  const [error, setError] = useState('');
  useEffect(() => {
    setError('');
    setShow(false);
    setShowConfirm(false);
  }, [registering]);
  const { data: google } = useQuery<{
    enabled: boolean;
    message: string;
  }>({
    queryKey: ['google-provider'],
    queryFn: async () => (await apiClient.get('/auth/google/status')).data,
    enabled: true,
    retry: false,
  });
  useEffect(() => {
    const problem = new URLSearchParams(window.location.search).get('google_error');
    if (problem)
      setError(
        problem === 'setup'
          ? 'Google sign-in is awaiting provider setup. You can use email sign-in.'
          : 'Google sign-in could not be completed. Please try again.',
      );
  }, []);
  const [forgot, setForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [remember, setRemember] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<Values>({ resolver: zodResolver(authSchema(registering, true)) });
  const submit = handleSubmit(
    async (values) => {
      character.reset();
      setError('');
      if (registering && (!values.name?.trim() || !values.institution?.trim())) {
        character.fail();
        setError('Complete your name and institution or company.');
        return;
      }
      if (registering && values.confirm !== values.password) {
        character.fail();
        setError('Passwords do not match.');
        return;
      }
      setLoading(true);
      try {
        const user = registering
          ? await authService.register(values.name!, values.email, role, values.password, {
              institution: values.institution,
              course: values.course,
              branch: values.branch,
              year: values.year,
            })
          : await authService.login(values.email, values.password, remember);
        client.clear();
        character.succeed();
        router.push(user.isAdmin ? '/admin/dashboard' : `/${user.role}/dashboard`);
      } catch (e) {
        character.fail();
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    () => character.fail(),
  );
  return (
    <div
      className={`auth-page compact-auth character-auth grid min-h-screen grid-cols-1 lg:grid-cols-[0.85fr_1fr] ${registering ? 'register-auth' : 'login-auth'}`}
    >
      <div className="auth-form-side">
        <Logo />
        <Link className="auth-back" href="/">
          <ArrowLeft size={15} /> Back to home
        </Link>
        <div className="auth-content">
          <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
          <h1>{registering ? 'Create your account' : 'Welcome back'}</h1>
          <p>
            {registering
              ? 'Your campus-to-career journey starts here.'
              : 'Sign in to continue your placement journey.'}
          </p>
          {registering && (
            <div className="role-selector" role="group" aria-label="Choose your role">
              {(
                [
                  { role: 'student', label: 'Student', icon: GraduationCap },
                  { role: 'recruiter', label: 'Recruiter', icon: BriefcaseBusiness },
                  { role: 'campus', label: 'Campus team', icon: Building2 },
                ] as const
              ).map((r) => (
                <button
                  key={r.role}
                  type="button"
                  aria-pressed={role === r.role && selected}
                  className={role === r.role && selected ? 'selected' : ''}
                  onClick={() => {
                    setRole(r.role);
                    setSelected(true);
                  }}
                >
                  <r.icon size={22} />
                  {r.label}
                </button>
              ))}
            </div>
          )}
          {(!registering || selected) && (
            <div className="google-sign-in">
              <button
                type="button"
                className="google-auth-button"
                disabled={!hydrated || !google?.enabled}
                onClick={() => {
                  window.location.assign(`/api/v1/auth/google?role=${role}`);
                }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.8-1.76-5.58-4.12H3.08v2.59A10 10 0 0 0 12 22Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M6.42 13.93a6 6 0 0 1 0-3.86V7.48H3.08a10 10 0 0 0 0 9.04l3.34-2.59Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.92 5.48l3.34 2.59C7.2 7.71 9.4 5.95 12 5.95Z"
                  />
                </svg>
                Continue with Google
              </button>
              <small>
                {google?.enabled
                  ? 'Add your remaining details in your dashboard.'
                  : google?.message || 'Checking Google sign-in availability…'}
              </small>
              <div className="auth-divider">
                <span>or use your email</span>
              </div>
            </div>
          )}
          {(!registering || selected) && (
            <form
              method="post"
              onSubmit={submit}
              className={`form-stack ${registering ? 'auth-registration-grid' : ''}`}
            >
              {registering && (
                <AuthInput
                  id="auth-name"
                  label="Full name"
                  error={errors.name?.message}
                  inputProps={{
                    ...register('name', { onChange: character.type, onBlur: character.blur }),
                    onFocus: () => character.focus('name'),
                    required: true,
                    placeholder: 'Your full name',
                    autoComplete: 'name',
                  }}
                />
              )}
              <AuthInput
                id="auth-email"
                label={
                  registering && role !== 'student' ? 'Work / official email' : 'Email address'
                }
                error={errors.email?.message}
                inputProps={{
                  ...register('email', { onChange: character.type, onBlur: character.blur }),
                  onFocus: () => character.focus('email'),
                  type: 'email',
                  placeholder: 'you@example.com',
                  autoComplete: 'email',
                }}
              />
              <PasswordInput
                id="auth-password"
                label="Password"
                error={errors.password?.message}
                visible={show}
                onToggle={() => setShow(!show)}
                onToggleFocus={() => character.focus('password')}
                onToggleBlur={character.blur}
                inputProps={{
                  ...register('password', { onBlur: character.blur }),
                  onFocus: () => character.focus('password'),
                  placeholder: registering ? 'At least 10 characters' : 'Enter your password',
                  autoComplete: registering ? 'new-password' : 'current-password',
                }}
              />
              {registering && (
                <>
                  <PasswordInput
                    id="auth-confirm"
                    label="Confirm password"
                    error={errors.confirm?.message}
                    visible={showConfirm}
                    onToggle={() => setShowConfirm(!showConfirm)}
                    onToggleFocus={() => character.focus('confirm')}
                    onToggleBlur={character.blur}
                    inputProps={{
                      ...register('confirm', { onBlur: character.blur }),
                      onFocus: () => character.focus('confirm'),
                      required: true,
                      autoComplete: 'new-password',
                      placeholder: 'Repeat your password',
                    }}
                  />
                  {role !== 'student' ? (
                    <>
                      <input type="hidden" {...register('institution')} />
                      <OrganizationPicker
                        showHelp={false}
                        kind={role === 'campus' ? 'universities' : 'companies'}
                        label={role === 'campus' ? 'College / university' : 'Company name'}
                        value={watch('institution') || ''}
                        onChange={(value) =>
                          setValue('institution', value, { shouldValidate: true })
                        }
                      />
                    </>
                  ) : (
                    <FormField
                      label={
                        role === 'student'
                          ? 'College / university'
                          : role === 'recruiter'
                            ? 'Company name'
                            : 'Institution name'
                      }
                    >
                      <input
                        {...register('institution')}
                        aria-invalid={!!errors.institution}
                        aria-describedby={errors.institution ? 'institution-error' : undefined}
                        list={role === 'student' ? 'registration-campuses' : undefined}
                        required
                        placeholder={
                          role === 'student'
                            ? 'Delhi Technological University'
                            : 'Organization name'
                        }
                      />
                      {role === 'student' && true && (
                        <datalist id="registration-campuses">
                          {campuses?.map((c) => (
                            <option key={c.id} value={c.name} />
                          ))}
                        </datalist>
                      )}
                      {
                        <small>
                          {campusesError
                            ? campusesError.message
                            : campusesLoading
                              ? 'Loading registered colleges…'
                              : campuses?.length
                                ? 'Choose your registered college from the suggestions. If it is missing, ask your campus team to register first.'
                                : 'Your campus team must register the college before students can sign up.'}
                        </small>
                      }
                    </FormField>
                  )}
                  {errors.institution && (
                    <p id="institution-error" role="alert" className="field-error">
                      {errors.institution.message}
                    </p>
                  )}
                  {role === 'student' ? (
                    <>
                      <FormField label="Graduation year">
                        <select {...register('year')}>
                          <option>2027</option>
                          <option>2026</option>
                          <option>2028</option>
                          <option>2029</option>
                        </select>
                      </FormField>
                      <div className="form-row">
                        <FormField label="Course">
                          <select {...register('course')}>
                            <option>B.Tech</option>
                            <option>B.Sc</option>
                            <option>M.Tech</option>
                            <option>MCA</option>
                            <option>MBA</option>
                          </select>
                        </FormField>
                        <FormField label="Branch">
                          <select {...register('branch')}>
                            <option>Computer Science</option>
                            <option>Information Technology</option>
                            <option>Electronics</option>
                            <option>Mechanical</option>
                          </select>
                        </FormField>
                      </div>
                    </>
                  ) : (
                    <FormField label="Designation">
                      <input {...register('designation')} required placeholder="Your role" />
                    </FormField>
                  )}
                  <label className="checkbox-label">
                    <input type="checkbox" required /> I agree to the{' '}
                    <Link href="/about?section=privacy">Terms & Privacy</Link>
                  </label>
                </>
              )}
              {!registering && (
                <div className="form-between">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />{' '}
                    Remember me
                  </label>
                  <button type="button" className="text-button" onClick={() => setForgot(true)}>
                    Forgot password?
                  </button>
                </div>
              )}
              {error && (
                <p role="alert" className="field-error">
                  {error}
                </p>
              )}
              <Button type="submit" loading={loading} disabled={!hydrated}>
                {loading
                  ? 'Opening your next chapter…'
                  : registering
                    ? 'Create your account'
                    : 'Sign in'}{' '}
                <ArrowUpRight size={17} />
              </Button>
            </form>
          )}
          <p className="auth-switch">
            {registering ? 'Already have an account?' : 'New around here?'}{' '}
            <Link href={registering ? '/login' : '/register'}>
              {registering ? 'Sign in' : 'Create an account'} <ArrowUpRight size={12} />
            </Link>
          </p>
        </div>
        <small className="auth-footer">© 2026 CampusLink · Made for what comes next.</small>
      </div>
      <AuthBrandPanel
        emailFocused={character.focused === 'name' || character.focused === 'email'}
        typing={character.typing}
        passwordFocused={character.focused === 'password' || character.focused === 'confirm'}
        passwordVisible={character.focused === 'confirm' ? showConfirm : show}
        success={character.success}
        error={character.error}
      />
      {forgot && (
        <Modal title="Reset your password" onClose={() => setForgot(false)}>
          {resetSent ? (
            <p className="success-note">
              If this email is registered, a reset link will be sent. Local development emails can
              be viewed by the project operator.
            </p>
          ) : (
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const values = new FormData(e.currentTarget);
                  await authService.requestReset(String(values.get('email')));
                  setResetSent(true);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <p>We’ll send a password reset link if your email is registered.</p>
              <FormField label="Email address">
                <input name="email" type="email" required placeholder="you@example.com" />
              </FormField>
              <Button type="submit">Request reset link</Button>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
