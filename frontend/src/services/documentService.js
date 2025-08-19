import api from './api';

class DocumentService {
  async getDocuments(page = 1, limit = 20) {
    const response = await api.get(`/documents?page=${page}&limit=${limit}`);
    return response.data;
  }

  async getDocument(uuid) {
    const response = await api.get(`/documents/${uuid}`);
    return response.data;
  }

  async uploadDocument(file, onProgress) {
    const formData = new FormData();
    formData.append('pdf', file);

    const response = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });

    return response.data;
  }

  async addField(documentUuid, fieldData) {
    const response = await api.post(`/documents/${documentUuid}/fields`, fieldData);
    return response.data;
  }

  async removeField(documentUuid, fieldId) {
    const response = await api.delete(`/documents/${documentUuid}/fields/${fieldId}`);
    return response.data;
  }

  async downloadSignedDocument(documentUuid) {
    const response = await api.post(`/documents/${documentUuid}/download`, {}, {
      responseType: 'blob',
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `signed-document.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    return response;
  }

  getDocumentFileUrl(documentUuid) {
    return `${api.defaults.baseURL}/documents/${documentUuid}/file`;
  }
}

export const documentService = new DocumentService();
