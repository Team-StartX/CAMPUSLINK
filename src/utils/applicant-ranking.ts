import type { Drive, WorkspaceData } from '@/types';
import type { ApplicantRanking } from '@/types/recruitment';
import { normalizeSkill, skillNames } from './skills';

export function rankApplicants(profiles: WorkspaceData[], drives: Drive[]): ApplicantRanking[] {
  return drives.flatMap((drive) => {
    const required = skillNames(drive.skills);
    const rows = profiles.flatMap((profile) =>
      profile.applications
        .filter((application) => application.opportunityId === (drive.opportunityId || drive.id))
        .map((application) => {
          const matchedSkills = required.filter((name) =>
            profile.student.skills.some(
              (skill) => normalizeSkill(skill.name) === normalizeSkill(name),
            ),
          );
          return {
            applicationId: application.id,
            studentId: profile.student.id,
            name: profile.student.name,
            driveId: drive.id,
            company: drive.company,
            role: drive.role,
            stage: application.stage,
            rank: 0,
            skillMatch: required.length
              ? Math.round((100 * matchedSkills.length) / required.length)
              : 100,
            matchedSkills,
            missingSkills: required.filter((name) => !matchedSkills.includes(name)),
          };
        }),
    );
    rows.sort((a, b) => b.skillMatch - a.skillMatch || a.studentId.localeCompare(b.studentId));
    return rows.map((row, index) => ({
      ...row,
      rank:
        index && rows[index - 1].skillMatch === row.skillMatch
          ? rows.findIndex((candidate) => candidate.skillMatch === row.skillMatch) + 1
          : index + 1,
    }));
  });
}
