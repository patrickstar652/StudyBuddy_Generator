import axios from 'axios';

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE_URL = configuredApiBaseUrl
  ? configuredApiBaseUrl.replace(/\/+$/, '')
  : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const getApiErrorMessage = (error, fallback = '操作失敗，請稍後再試') => {
  const responseData = error?.response?.data;

  if (typeof responseData?.error === 'string' && responseData.error.trim()) {
    return responseData.error;
  }

  if (typeof responseData?.message === 'string' && responseData.message.trim()) {
    return responseData.message;
  }

  if (error?.code === 'ERR_NETWORK') {
    return '無法連線到伺服器，請確認後端服務是否已啟動';
  }

  return fallback;
};

export const isRequestCanceled = (error) => (
  axios.isCancel(error) || error?.code === 'ERR_CANCELED'
);

// Document APIs
export const documentApi = {
  // 上傳文件
  upload: async (file, config = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/documents/upload', formData, config);
    return response.data;
  },

  // 獲取所有文件
  getAll: async (config = {}) => {
    const response = await api.get('/documents/', config);
    return response.data;
  },

  // 獲取單個文件
  get: async (docId, config = {}) => {
    const response = await api.get(`/documents/${docId}`, config);
    return response.data;
  },

  // 刪除文件
  delete: async (docId, config = {}) => {
    const response = await api.delete(`/documents/${docId}`, config);
    return response.data;
  },

  // 預覽文件
  preview: async (docId, config = {}) => {
    const response = await api.get(`/documents/${docId}/preview`, config);
    return response.data;
  },
};

// Study Tools APIs
export const studyApi = {
  // 生成測驗
  generateQuiz: async (docId, options = {}, config = {}) => {
    const response = await api.post(`/study/quiz/${docId}`, options, config);
    return response.data;
  },

  // 獲取測驗歷史
  getQuizzes: async (docId, config = {}) => {
    const response = await api.get(`/study/quizzes/${docId}`, config);
    return response.data;
  },

  // 生成閃卡
  generateFlashcards: async (docId, options = {}, config = {}) => {
    const response = await api.post(`/study/flashcards/${docId}`, options, config);
    return response.data;
  },

  // 獲取閃卡歷史
  getFlashcards: async (docId, config = {}) => {
    const response = await api.get(`/study/flashcards/${docId}`, config);
    return response.data;
  },

  // 生成摘要
  generateSummary: async (docId, options = {}, config = {}) => {
    const response = await api.post(`/study/summary/${docId}`, options, config);
    return response.data;
  },

  // 獲取摘要歷史
  getSummaries: async (docId, config = {}) => {
    const response = await api.get(`/study/summaries/${docId}`, config);
    return response.data;
  },

  // 問答
  askQuestion: async (docId, question, config = {}) => {
    const response = await api.post(`/study/ask/${docId}`, { question }, config);
    return response.data;
  },

  // 搜索
  search: async (docId, query, topK = 5, config = {}) => {
    const response = await api.post(`/study/search/${docId}`, { query, top_k: topK }, config);
    return response.data;
  },
};

// Health check
export const healthCheck = async (config = {}) => {
  const response = await api.get('/health', config);
  return response.data;
};

export default api;
