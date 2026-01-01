import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, BookOpen, Brain, FileText, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import FileUpload from '../components/FileUpload';
import DocumentCard from '../components/DocumentCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { documentApi } from '../services/api';

function HomePage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const data = await documentApi.getAll();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      toast.error('Failed to load neural archives');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const result = await documentApi.upload(selectedFile);
      toast.success('Neural link established successfully!');
      setSelectedFile(null);
      fetchDocuments();
      
      if (result.document?.id) {
        navigate(`/document/${result.document.id}`);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(error.response?.data?.error || 'Uplink failed. Retry?');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!confirm('Purge this knowledge from the archives?')) return;

    try {
      await documentApi.delete(docId);
      toast.success('Archive purged');
      setDocuments(documents.filter(doc => doc.id !== docId));
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Purge failed');
    }
  };

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <div className="text-center relative animate-fade-in-up">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-blue-500/20 blur-[100px] -z-10 rounded-full" />
        
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-white/80 dark:bg-slate-800/50 border border-blue-200 dark:border-blue-500/30 backdrop-blur-sm animate-float shadow-sm dark:shadow-none">
          <Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          <span className="text-sm text-slate-700 dark:text-cyan-200 font-medium">新世代 AI 智慧學習助手</span>
        </div>
        
        <h1 className="text-6xl font-bold mb-6 tracking-tight">
          <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 dark:from-white dark:via-cyan-200 dark:to-blue-200 bg-clip-text text-transparent text-glow">
            升級您的
          </span>
          <br />
          <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent text-glow">
            學習體驗
          </span>
        </h1>
        
        <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium">
          上傳學習教材，讓我們的 AI 為您生成測驗、閃卡和重點摘要。
          將被動閱讀轉化為主動掌握。
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up delay-200">
        {[
          { icon: Zap, color: 'text-yellow-600 dark:text-yellow-400', title: '即時測驗', desc: 'AI 生成問題，即時測試您的理解程度。' },
          { icon: BookOpen, color: 'text-purple-600 dark:text-purple-400', title: '智慧閃卡', desc: '提取關鍵術語並格式化，實現高效的間隔重複學習。' },
          { icon: Brain, color: 'text-green-600 dark:text-green-400', title: '神經摘要', desc: '將複雜的文件提煉為核心洞察。' }
        ].map((feature, idx) => (
          <div key={idx} className="glass-card p-8 rounded-2xl hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors group">
            <div className={`bg-slate-200/50 dark:bg-slate-900/50 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-slate-200/50 dark:border-white/5`}>
              <feature.icon className={`h-7 w-7 ${feature.color}`} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{feature.title}</h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              {feature.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Upload Section */}
      <div className="glass-panel rounded-3xl p-1 relative overflow-hidden animate-scale-in delay-300">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 blur-xl opacity-50" />
        <div className="relative bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl rounded-[22px] p-8 md:p-12 border border-slate-200 dark:border-white/5">
          <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-8">啟動新的學習序列</h2>
          <div className="max-w-2xl mx-auto">
            <FileUpload
              onFileSelect={handleFileSelect}
              uploading={uploading}
              selectedFile={selectedFile}
              onClear={() => setSelectedFile(null)}
            />
            {selectedFile && !uploading && (
              <div className="mt-8 flex justify-center animate-fade-in-up">
                <button
                  onClick={handleUpload}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] hover:scale-105 transition-all duration-300 flex items-center gap-3 group relative overflow-hidden"
                >
                  <Sparkles className="h-5 w-5 animate-pulse" />
                  <span className="relative z-10">開始分析</span>
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <div className="absolute inset-0 rounded-xl ring-2 ring-white/20 group-hover:ring-cyan-400/50 transition-all" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="animate-fade-in-up delay-500">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <span className="w-1 h-8 bg-gradient-to-b from-cyan-400 to-purple-400 rounded-full" />
            神經檔案庫
          </h2>
          <div className="px-4 py-1 rounded-full bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400">
            {documents.length} 筆記錄
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="正在存取神經數據庫..." />
        ) : documents.length === 0 ? (
          <div className="glass-card text-center py-24 rounded-3xl border-dashed border-2 border-slate-300 dark:border-slate-700 animate-scale-in">
            <div className="bg-slate-200/50 dark:bg-slate-800/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 animate-float">
              <FileText className="h-10 w-10 text-slate-500" />
            </div>
            <p className="text-xl text-slate-500 dark:text-slate-400 font-medium">找不到檔案</p>
            <p className="text-slate-500 dark:text-slate-500 mt-2">上傳您的第一份文件以開始序列。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc, idx) => (
              <div key={doc.id} className="animate-fade-in-up" style={{ animationDelay: `${idx * 100}ms` }}>
                <DocumentCard
                  document={doc}
                  onDelete={handleDelete}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default HomePage;
