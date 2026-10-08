import { apiClient } from './api/client';
import { remoteService, rpc } from './api/remote';
import type * as local from './platform.domain';
export const studentService = remoteService<typeof local.studentService>('studentService');
export const matchingService = remoteService<typeof local.matchingService>('matchingService');
export const applicationService =
  remoteService<typeof local.applicationService>('applicationService');
export const assessmentService = remoteService<typeof local.assessmentService>('assessmentService');
export const contestService = remoteService<typeof local.contestService>('contestService');
export const aiService = remoteService<typeof local.aiService>('aiService', {
  // Storage retrieval and optional analysis can exceed the ordinary 30-second request limit.
  analyzeResume: (documentId: string) =>
    rpc<Awaited<ReturnType<typeof local.aiService.analyzeResume>>>(
      'aiService',
      'analyzeResume',
      [documentId],
      60000,
    ),
});
export const interviewService = remoteService<typeof local.interviewService>('interviewService');
export const recruiterService = remoteService<typeof local.recruiterService>('recruiterService');
export const campusService = remoteService<typeof local.campusService>('campusService');
export const notificationService =
  remoteService<typeof local.notificationService>('notificationService');
export const offerService = remoteService<typeof local.offerService>('offerService');
export const documentService = {
  verify: (id: string) =>
    rpc<Awaited<ReturnType<typeof local.documentService.verify>>>('documentService', 'verify', [
      id,
    ]),
  remove: (id: string) =>
    rpc<Awaited<ReturnType<typeof local.documentService.remove>>>('documentService', 'remove', [
      id,
    ]),
  upload: async (file: File, type: string) => {
    await rpc('studentService', 'getDashboard');
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    return (await apiClient.post('/documents', form)).data;
  },
  download: async (id: string, studentId?: string) => {
    const { data } = await apiClient.get('/documents/' + id + '/download', {
      responseType: 'blob',
      ...(studentId ? { headers: { 'X-Student-ID': studentId } } : {}),
    });
    return URL.createObjectURL(data);
  },
};
export const learningService = remoteService<typeof local.learningService>('learningService');
