import { z } from 'zod';

export const instituteStudentPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    course: z.string().trim().min(2).max(150).optional(),
    branch: z.string().trim().min(2).max(80).optional(),
    year: z
      .string()
      .regex(/^20\d{2}$/)
      .optional(),
    cgpa: z.number().min(0).max(10).optional(),
    activeBacklogs: z.number().int().min(0).max(20).optional(),
    bio: z.string().max(3000).optional(),
    projects: z.array(z.string().trim().min(1).max(500)).max(40).optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, 'Choose a field to update.');

export type InstituteStudentPatch = z.infer<typeof instituteStudentPatchSchema>;
