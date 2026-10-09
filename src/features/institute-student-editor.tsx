'use client';
import { useState } from 'react';
import type { Student } from '@/types';
import { Button, FormField, Modal } from '@/components/ui';
import { campusService } from '@/services/platform.service';
import { instituteStudentPatchSchema } from '@/utils/student-records';

export function InstituteStudentEditor({
  student,
  onClose,
  onSaved,
}: {
  student: Student;
  onClose: () => void;
  onSaved: (student: Student) => void;
}) {
  const [values, setValues] = useState({
    name: student.name,
    course: student.course,
    branch: student.branch || student.course.split('·')[1]?.trim() || '',
    year: student.year,
    cgpa: String(student.cgpa),
    activeBacklogs: String(student.activeBacklogs || 0),
    bio: student.bio,
    projects: student.projects.join('\n'),
  });
  const [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const set = (key: keyof typeof values, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));
  return (
    <Modal title="Edit student record" onClose={onClose}>
      <p className="muted">
        {student.id} · {student.campus}
      </p>
      <form
        className="form-stack institute-student-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (saving) return;
          setError('');
          const patch = instituteStudentPatchSchema.safeParse({
            ...values,
            cgpa: Number(values.cgpa),
            activeBacklogs: Number(values.activeBacklogs),
            projects: values.projects
              .split('\n')
              .map((p) => p.trim())
              .filter(Boolean),
          });
          if (!patch.success) {
            setError(patch.error.issues[0]?.message || 'Check your student details.');
            return;
          }
          const changed = Object.fromEntries(
            Object.entries(patch.data).filter(
              ([key, value]) =>
                JSON.stringify(value) !== JSON.stringify(student[key as keyof Student]),
            ),
          );
          if (!Object.keys(changed).length) {
            setError('Make a change before saving the record.');
            return;
          }
          setSaving(true);
          try {
            onSaved(await campusService.updateStudent(student.id, changed));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <FormField label="Full name">
          <input
            required
            minLength={2}
            maxLength={120}
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </FormField>
        <div className="form-row">
          <FormField label="Course">
            <input
              required
              minLength={2}
              maxLength={150}
              value={values.course}
              onChange={(e) => set('course', e.target.value)}
            />
          </FormField>
          <FormField label="Branch">
            <input
              required
              minLength={2}
              maxLength={80}
              value={values.branch}
              onChange={(e) => set('branch', e.target.value)}
            />
          </FormField>
        </div>
        <div className="form-row">
          <FormField label="Graduation year">
            <input
              required
              pattern="20[0-9]{2}"
              maxLength={4}
              value={values.year}
              onChange={(e) => set('year', e.target.value)}
            />
          </FormField>
          <FormField label="CGPA">
            <input
              required
              type="number"
              min={0}
              max={10}
              step="0.01"
              value={values.cgpa}
              onChange={(e) => set('cgpa', e.target.value)}
            />
          </FormField>
          <FormField label="Active backlogs">
            <input
              required
              type="number"
              min={0}
              max={20}
              step={1}
              value={values.activeBacklogs}
              onChange={(e) => set('activeBacklogs', e.target.value)}
            />
          </FormField>
        </div>
        <FormField label="About the student">
          <textarea
            rows={3}
            maxLength={3000}
            value={values.bio}
            onChange={(e) => set('bio', e.target.value)}
          />
        </FormField>
        <FormField label="Projects (one per line)">
          <textarea
            rows={3}
            value={values.projects}
            onChange={(e) => set('projects', e.target.value)}
          />
        </FormField>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="institute-editor-actions">
          <Button kind="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save student record'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
