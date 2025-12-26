import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Document APIs
export const documentApi = {
  // 上傳文件
  upload: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // 獲取所有文件
  getAll: async () => {
    const response = await api.get('/documents/');
    return response.data;
  },

  // 獲取單個文件
  get: async (docId) => {
    const response = await api.get(`/documents/${docId}`);
    return response.data;
  },

  // 刪除文件
  delete: async (docId) => {
    const response = await api.delete(`/documents/${docId}`);
    return response.data;
  },

  // 預覽文件
  preview: async (docId) => {
    const response = await api.get(`/documents/${docId}/preview`);
    return response.data;
  },
};

// Study Tools APIs
export const studyApi = {
  // 生成測驗
  generateQuiz: async (docId, options = {}) => {
    const response = await api.post(`/study/quiz/${docId}`, options);
    return response.data;
  },

  // 生成閃卡
  generateFlashcards: async (docId, options = {}) => {
    const response = await api.post(`/study/flashcards/${docId}`, options);
    return response.data;
  },

  // 生成摘要
  generateSummary: async (docId, options = {}) => {
    const response = await api.post(`/study/summary/${docId}`, options);
    return response.data;
  },

  // 問答
  askQuestion: async (docId, question) => {
    const response = await api.post(`/study/ask/${docId}`, { question });
    return response.data;
  },

  // 搜索
  search: async (docId, query, topK = 5) => {
    const response = await api.post(`/study/search/${docId}`, { query, top_k: topK });
    return response.data;
  },
};

// Health check
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

export default api;
