'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession, authService } from '@/store/session';
import { apiClient } from '@/services/api/client';
import { Button, FormField } from './ui';
import type { Campus } from '@/types';

export function AccountOnboarding() {
  const user = useSession((s) => s.user),
    client = useQueryClient();
  const [name, setName] = useState(user?.name || ''),
    [institution, setInstitution] = useState(''),
    [campusId, setCampusId] = useState('');
  const [course, setCourse] = useState(''),
    [branch, setBranch] = useState(''),
    [year, setYear] = useState(''),
    [cgpa, setCgpa] = useState('');
  const [bio, setBio] = useState(''),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  const { data: campuses = [] } = useQuery<Campus[]>({
    queryKey: ['registration-campuses'],
    queryFn: async () => (await apiClient.get('/campuses')).data,
  });
  const student = user?.role === 'student';
  return (
    <section
      className="panel"
      style={{ maxWidth: 780, margin: '24px auto', padding: 'clamp(20px, 4vw, 40px)' }}
    >
      <span className="eyebrow">ONE LAST STEP</span>
      <h1>Make this workspace yours.</h1>
      <p>
        Your Google email is verified. Add the details your{' '}
        {student ? 'career profile' : 'organization workspace'} needs.
      </p>
      <form
        method="post"
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          setSaving(true);
          try {
            await authService.restore();
            const { data } = await apiClient.put('/account/onboarding', {
              name,
              institution,
              ...(campusId ? { campusId } : {}),
              ...(student ? { course, branch, year, cgpa: Number(cgpa), bio } : {}),
            });
            useSession.getState().setUser(data.user);
            client.clear();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="two-columns">
          <FormField label="Full name">
            <input
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <FormField label="Verified email">
            <input value={user?.email || ''} readOnly type="email" />
          </FormField>
        </div>
        {student ? (
          <FormField label="College / university">
            <select
              required
              value={campusId}
              onChange={(e) => {
                setCampusId(e.target.value);
                setInstitution(campuses.find((c) => c.id === e.target.value)?.name || '');
              }}
            >
              <option value="">Choose your campus</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {!campuses.length && (
              <small>
                Your campus team must register the institution before you can finish setup.
              </small>
            )}
          </FormField>
        ) : (
          <FormField label={user?.role === 'campus' ? 'College / university name' : 'Company name'}>
            <input
              required
              minLength={2}
              maxLength={150}
              value={institution}
              autoComplete="organization"
              onChange={(e) => setInstitution(e.target.value)}
            />
          </FormField>
        )}
        {student && (
          <>
            <div className="two-columns">
              <FormField label="Course">
                <input
                  required
                  maxLength={100}
                  placeholder="e.g. B.Tech"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                />
              </FormField>
              <FormField label="Branch">
                <input
                  required
                  maxLength={80}
                  placeholder="e.g. Computer Science"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </FormField>
              <FormField label="Graduation year">
                <input
                  required
                  type="number"
                  min={2000}
                  max={2099}
                  placeholder="e.g. 2027"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </FormField>
              <FormField label="CGPA (out of 10)">
                <input
                  required
                  type="number"
                  min={0}
                  max={10}
                  step="0.01"
                  value={cgpa}
                  onChange={(e) => setCgpa(e.target.value)}
                />
              </FormField>
            </div>
            <FormField label="About you (optional)">
              <textarea
                maxLength={1500}
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Your interests and career goals"
              />
            </FormField>
            <small>
              You can add your photo, resume, skills and projects in My career profile after setup.
            </small>
          </>
        )}
        {!student && (
          <p>
            Organization accounts require approval before placement operations become available.
          </p>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={saving || (student && !campuses.length)}>
          {saving ? 'Saving your details…' : 'Save and open dashboard'}
        </Button>
      </form>
    </section>
  );
}
