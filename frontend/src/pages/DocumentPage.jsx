import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  ClipboardList,
  Layers,
  FileSearch,
  ArrowLeft,
  MessageSquare,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner, { LoadingButton } from '../components/LoadingSpinner';
import { documentApi, studyApi } from '../services/api';

function DocumentPage() {
  const { docId } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState(null);

  useEffect(() => {
    fetchDocument();
  }, [docId]);

  const fetchDocument = async () => {
    try {
      const [docData, previewData] = await Promise.all([
        documentApi.get(docId),
        documentApi.preview(docId),
      ]);
      setDocument(docData.document);
      setPreview(previewData.preview);
    } catch (error) {
      console.error('Failed to fetch document:', error);
      toast.error('無法載入文件');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    setAsking(true);
    setAnswer(null);
    try {
      const result = await studyApi.askQuestion(docId, question);
      setAnswer(result);
    } catch (error) {
      console.error('Failed to get answer:', error);
      toast.error('無法獲取答案');
    } finally {
      setAsking(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="載入文件中..." />;
  }

  if (!document) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">找不到文件</p>
        <Link to="/" className="text-blue-600 hover:underline mt-2 inline-block">
          返回首頁
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            to="/"
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-4 rounded-2xl">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {document.original_filename}
              </h1>
              <p className="text-gray-500">
                {document.total_tokens?.toLocaleString()} tokens · {document.total_chunks} 區塊
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Study Tools */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">學習工具</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to={`/quiz/${docId}`}
            className="flex items-center gap-4 p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 hover:shadow-md transition-all group"
          >
            <div className="bg-blue-500 p-3 rounded-xl group-hover:scale-110 transition-transform">
              <ClipboardList className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">生成隨堂考</h3>
              <p className="text-sm text-gray-600">測試你的理解程度</p>
            </div>
          </Link>

          <Link
            to={`/flashcards/${docId}`}
            className="flex items-center gap-4 p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 hover:shadow-md transition-all group"
          >
            <div className="bg-purple-500 p-3 rounded-xl group-hover:scale-110 transition-transform">
              <Layers className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">生成閃卡</h3>
              <p className="text-sm text-gray-600">快速複習關鍵概念</p>
            </div>
          </Link>

          <Link
            to={`/summary/${docId}`}
            className="flex items-center gap-4 p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200 hover:shadow-md transition-all group"
          >
            <div className="bg-green-500 p-3 rounded-xl group-hover:scale-110 transition-transform">
              <FileSearch className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">畫重點 TL;DR</h3>
              <p className="text-sm text-gray-600">快速掌握核心內容</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Ask Question */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-blue-600" />
          向文件提問
        </h2>
        <form onSubmit={handleAskQuestion} className="space-y-4">
          <div className="flex gap-4">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="輸入你的問題..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={asking}
            />
            <LoadingButton
              type="submit"
              loading={asking}
              disabled={!question.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              發送
            </LoadingButton>
          </div>
        </form>

        {answer && (
          <div className="mt-6 p-6 bg-blue-50 rounded-xl border border-blue-200">
            <h3 className="font-semibold text-gray-900 mb-2">AI 回答：</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{answer.answer}</p>
            {answer.sources && answer.sources.length > 0 && (
              <div className="mt-4 pt-4 border-t border-blue-200">
                <p className="text-sm text-gray-500 mb-2">參考來源：</p>
                <div className="space-y-2">
                  {answer.sources.slice(0, 2).map((source, idx) => (
                    <div
                      key={idx}
                      className="text-sm text-gray-600 bg-white p-3 rounded-lg"
                    >
                      {source.content.substring(0, 200)}...
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Document Preview */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">文件預覽</h2>
        <div className="bg-gray-50 rounded-xl p-6 max-h-96 overflow-y-auto">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
            {preview}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default DocumentPage;
