import { remoteService } from './api/remote';
import { defaultDrive } from './drive.defaults';
import type { driveService as domain } from './drive.domain';
export { driveRequestSchema, scheduleConflicts, scheduleSchema } from './drive.validation';
export const driveService = remoteService<typeof domain>('driveService', {
  getRequestDefaults: defaultDrive,
});
