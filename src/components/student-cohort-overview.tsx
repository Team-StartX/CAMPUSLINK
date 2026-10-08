'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Users, ShieldCheck, GraduationCap } from 'lucide-react';
import { campusService } from '@/services/platform.service';
import { useSession } from '@/store/session';
import type { Student } from '@/types';

export function StudentCohortOverview({ people }: { people: Student[] }) {
  const verified = people.filter((p) => p.skills.some((s) => s.verified)).length;
  const skills = people.reduce((n, p) => n + p.skills.length, 0);
  const verifiedSkills = people.reduce((n, p) => n + p.skills.filter((s) => s.verified).length, 0);
  const branches = Object.entries(
    people.reduce<Record<string, number>>((all, p) => {
      const branch = p.branch || p.course || 'Not specified';
      all[branch] = (all[branch] || 0) + 1;
      return all;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  return (
    <section className="cohort-overview panel" aria-label="Student cohort overview">
      <div className="insight-metrics">
        <div>
          <Users size={20} />
          <strong>{people.length}</strong>
          <span>Registered students</span>
        </div>
        <div>
          <ShieldCheck size={20} />
          <strong>{verified}</strong>
          <span>With verified skills</span>
        </div>
        <div>
          <GraduationCap size={20} />
          <strong>
            {people.length
              ? (people.reduce((n, p) => n + p.cgpa, 0) / people.length).toFixed(1)
              : '—'}
          </strong>
          <span>Average CGPA / 10</span>
        </div>
      </div>
      <div className="cohort-charts">
        <div>
          <h3>Skill verification</h3>
          <p>
            {verifiedSkills} of {skills} recorded skills verified
          </p>
          <progress
            value={verifiedSkills}
            max={Math.max(1, skills)}
            aria-label="Verified skills across the student cohort"
          />
          <small>
            {skills ? Math.round((verifiedSkills / skills) * 100) : 0}% of recorded skills
          </small>
        </div>
        <div>
          <h3>Students by branch</h3>
          {branches.slice(0, 4).map(([name, count]) => (
            <div className="cohort-bar" key={name}>
              <span>{name}</span>
              <progress
                aria-label={`${name} students`}
                value={count}
                max={Math.max(1, people.length)}
              />
              <b>{count}</b>
            </div>
          ))}
          {branches.length > 4 && <small>+ {branches.length - 4} other branches</small>}
          {!people.length && <p>No students registered yet.</p>}
        </div>
      </div>
    </section>
  );
}

export function CampusStudentOverview() {
  const user = useSession((s) => s.user);
  const { data, isLoading, error } = useQuery({
    queryKey: ['people', 'campus', user?.id],
    queryFn: campusService.getStudents,
    enabled: user?.role === 'campus',
    refetchInterval: 15000,
  });
  return (
    <section className="campus-student-overview">
      <div className="panel-header">
        <h2>Your students at a glance</h2>
        <Link className="text-link" href="/campus/students">
          View all students →
        </Link>
      </div>
      {isLoading && <p role="status">Loading student overview…</p>}
      {error && (
        <p role="alert">Student overview unavailable. Open the student directory to retry.</p>
      )}
      {data && <StudentCohortOverview people={data} />}
      {Boolean(data?.length) && (
        <div className="panel campus-student-preview">
          <div className="panel-header">
            <h3>Student directory</h3>
            <small>
              Showing {Math.min(5, data!.length)} of {data!.length}
            </small>
          </div>
          {[...data!]
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 5)
            .map((student) => (
              <Link
                key={student.id}
                href={`/campus/students/${student.id}`}
                className="campus-student-row"
              >
                <span className="avatar-circle lavender">
                  {student.name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join('')}
                </span>
                <span>
                  <b>{student.name}</b>
                  <small>{student.branch || student.course || 'Course not added'}</small>
                </span>
                <span>{student.skills.filter((s) => s.verified).length} verified skills</span>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          <Link className="text-link" href="/campus/students">
            Open full student directory →
          </Link>
        </div>
      )}
    </section>
  );
}
