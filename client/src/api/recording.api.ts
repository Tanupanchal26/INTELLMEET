import api from './axios';

export const recordingService = {
  startRecording: (meetingId: string) => api.post('/recordings/start', { meetingId }),
  stopRecording: (recordingId: string) => api.post(`/recordings/${recordingId}/stop`),
  uploadRecording: (meetingId: string, blob: Blob) => {
    const formData = new FormData();
    formData.append('video', blob, `recording-${meetingId}.webm`);
    formData.append('meetingId', meetingId);
    return api.post('/recordings/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2 min timeout for large uploads
    });
  },
  getRecordings: () => api.get('/recordings'),
  getRecording: (id: string) => api.get(`/recordings/${id}`),
  deleteRecording: (id: string) => api.delete(`/recordings/${id}`),
};
