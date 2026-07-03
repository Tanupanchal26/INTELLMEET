import api from './axios';

export const mediaService = {
  uploadMedia: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getMedia: () => api.get('/media'),
  deleteMedia: (id: string) => api.delete(`/media/${id}`),
};
export default mediaService;
