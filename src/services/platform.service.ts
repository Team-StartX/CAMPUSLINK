import * as local from './platform.domain';
import { remoteService, backendEnabled, rpc } from './api/remote';
import { apiClient } from './api/client';
export const studentService = remoteService('studentService', local.studentService);
export const matchingService = remoteService('matchingService', local.matchingService);
export const applicationService = remoteService('applicationService', local.applicationService);
export const assessmentService = remoteService('assessmentService', local.assessmentService);
export const contestService = remoteService('contestService', local.contestService);
export const aiService = remoteService('aiService', local.aiService);
export const interviewService = remoteService('interviewService', local.interviewService);
export const recruiterService = remoteService('recruiterService', local.recruiterService);
export const campusService = remoteService('campusService', local.campusService);
export const notificationService = remoteService('notificationService', local.notificationService);
export const offerService = remoteService('offerService', local.offerService);
export const documentService = {
  ...remoteService('documentService', local.documentService),
  upload: async (file: File, type: string) => {
    if (!backendEnabled) return local.documentService.upload(file, type);
    await rpc('studentService', 'getDashboard');
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    return (await apiClient.post('/documents', form)).data;
  },
  download: async (id: string) => {
    const { data } = await apiClient.get('/documents/' + id + '/download', {
      responseType: 'blob',
    });
    return URL.createObjectURL(data);
  },
};
export const learningService = remoteService('learningService', local.learningService);
export const demoService = remoteService('demoService', local.demoService);
