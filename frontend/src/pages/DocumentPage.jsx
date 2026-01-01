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
  Zap,
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
      toast.error('Failed to retrieve document data');
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
      toast.error('Neural uplink failed');
    } finally {
      setAsking(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="正在存取安全檔案..." />;
  }

  if (!document) {
    return (
      <div className="text-center py-24 glass-card rounded-3xl animate-scale-in">
        <p className="text-slate-400 text-lg">找不到文件</p>
        <Link to="/" className="text-cyan-400 hover:text-cyan-300 mt-4 inline-block font-medium">
          返回儀表板
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400 mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回儀表板
          </Link>
          <div className="flex items-center gap-6">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-white/5 shadow-[0_0_20px_rgba(59,130,246,0.2)] animate-pulse">
              <FileText className="h-8 w-8 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                {document.original_filename}
              </h1>
              <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-sm">
                <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-white/5">
                  {document.total_tokens?.toLocaleString()} tokens
                </span>
                <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-white/5">
                  {document.total_chunks} chunks
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Study Tools */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up delay-100">
        <Link
          to={`/quiz/${docId}`}
          className="glass-card p-6 rounded-2xl hover:scale-105 transition-all duration-300 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="bg-yellow-100 dark:bg-yellow-500/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <ClipboardList className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">生成測驗</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">測試您的理解程度</p>
        </Link>

        <Link
          to={`/flashcards/${docId}`}
          className="glass-card p-6 rounded-2xl hover:scale-105 transition-all duration-300 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="bg-purple-100 dark:bg-purple-500/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Layers className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">閃卡複習</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">掌握關鍵概念</p>
        </Link>

        <Link
          to={`/summary/${docId}`}
          className="glass-card p-6 rounded-2xl hover:scale-105 transition-all duration-300 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="bg-green-100 dark:bg-green-500/20 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <FileSearch className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">神經摘要</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">即時提取智慧</p>
        </Link>
      </div>

      {/* Ask Question */}
      <div className="glass-panel p-1 rounded-3xl relative overflow-hidden animate-fade-in-up delay-200">
        <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[22px] p-8 border border-slate-200 dark:border-white/5">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
            查詢神經介面
          </h2>
          <form onSubmit={handleAskQuestion} className="space-y-4">
            <div className="flex gap-4">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="詢問關於此文件的任何問題..."
                className="flex-1 px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 text-slate-900 dark:text-slate-200 placeholder-slate-500 dark:placeholder-slate-600 transition-all"
                disabled={asking}
              />
              <LoadingButton
                type="submit"
                loading={asking}
                disabled={!question.trim()}
                className="px-8 py-4 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_0_20px_rgba(8,145,178,0.3)] hover:shadow-[0_0_30px_rgba(8,145,178,0.5)]"
              >
                <Send className="h-4 w-4" />
                查詢
              </LoadingButton>
            </div>
          </form>

          {answer && (
            <div className="mt-8">
              <div className="flex items-start gap-4 animate-float" style={{ animationDuration: '3s' }}>
                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-3 rounded-xl shadow-lg animate-scale-in">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 glass-card p-6 rounded-2xl rounded-tl-none border border-slate-200 dark:border-cyan-500/20 animate-fade-in-up">
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{answer.answer}</p>
                  
                  {answer.sources && answer.sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5">
                      <p className="text-xs text-cyan-600 dark:text-cyan-400 uppercase tracking-widest mb-3 font-semibold">來源向量</p>
                      <div className="space-y-2">
                        {answer.sources.slice(0, 2).map((source, idx) => (
                          <div
                            key={idx}
                            className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950/50 p-3 rounded-lg border border-slate-200 dark:border-white/5 font-mono"
                          >
                            {source.content.substring(0, 200)}...
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Document Preview */}
      <div className="glass-card rounded-2xl p-8 animate-fade-in-up delay-300">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6">原始數據預覽</h2>
        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-6 max-h-96 overflow-y-auto border border-slate-200 dark:border-white/5 custom-scrollbar">
          <pre className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-mono leading-relaxed">
            {preview}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default DocumentPage;
