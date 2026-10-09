'use client';
import Link from 'next/link';
import type { ApplicantRanking } from '@/types/recruitment';

export function ApplicantRankings({ rows }: { rows: ApplicantRanking[] }) {
  return (
    <section className="panel">
      <h2>Applicants ranked by skill match</h2>
      <p>
        Ranked within each job by required skills recorded on the applicant’s profile. Equal matches
        share a rank.
      </p>
      {!rows.length && <p>Rankings appear after students apply.</p>}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th>Job</th>
                <th>Skill match</th>
                <th>Matched skills</th>
                <th>Missing skills</th>
                <th>Stage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.applicationId}>
                  <td>{row.rank}</td>
                  <td>{row.name}</td>
                  <td>
                    <Link href={`/recruiter/drives/${row.driveId}`}>
                      {row.company} · {row.role}
                    </Link>
                  </td>
                  <td>{row.skillMatch}%</td>
                  <td>{row.matchedSkills.join(', ') || 'None recorded'}</td>
                  <td>{row.missingSkills.join(', ') || 'None'}</td>
                  <td>{row.stage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
