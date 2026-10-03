import { driveService as local } from './drive.domain';
import { remoteService } from './api/remote';
export { driveRequestSchema, scheduleSchema, scheduleConflicts } from './drive.domain';
export const driveService = remoteService('driveService', local, ['getRequestDefaults']);
