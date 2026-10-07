import { z } from 'zod';

export function authSchema(registering: boolean, apiMode: boolean) {
  return z
    .object({
      email: z.string().trim().email('Enter a valid email address.').max(254).toLowerCase(),
      password: z
        .string()
        .min(
          registering ? (apiMode ? 10 : 6) : 1,
          registering
            ? apiMode
              ? 'Use at least 10 characters.'
              : 'Use at least 6 characters.'
            : 'Enter your password.',
        )
        .max(128, 'Use no more than 128 characters.'),
      name: z.string().optional(),
      confirm: z.string().optional(),
      institution: z.string().optional(),
      designation: z.string().optional(),
      course: z.string().optional(),
      branch: z.string().optional(),
      year: z.string().optional(),
    })
    .superRefine((values, context) => {
      if (!registering) return;
      for (const [field, label, maximum] of [
        ['name', 'your full name', 120],
        ['institution', 'your college or company', 150],
      ] as const) {
        const value = values[field]?.trim() || '';
        if (value.length < 2 || value.length > maximum)
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `Enter ${label} using 2 to ${maximum} characters.`,
          });
      }
      if (values.confirm !== values.password)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['confirm'],
          message: 'Passwords do not match.',
        });
    });
}
