import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, BookOpen, Brain, FileText } from 'lucide-react';
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
      toast.error('無法載入文件列表');
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
      toast.success('文件上傳成功！');
      setSelectedFile(null);
      fetchDocuments();
      
      // 導航到文件頁面
      if (result.document?.id) {
        navigate(`/document/${result.document.id}`);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(error.response?.data?.error || '上傳失敗，請重試');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!confirm('確定要刪除這份文件嗎？')) return;

    try {
      await documentApi.delete(docId);
      toast.success('文件已刪除');
      setDocuments(documents.filter(doc => doc.id !== docId));
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('刪除失敗');
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center py-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="h-8 w-8 text-yellow-500" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            AI 學習夥伴
          </h1>
        </div>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          上傳你的學習材料，讓 AI 幫你生成測驗、閃卡和摘要，
          <br />把被動學習轉變為主動學習！
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-shadow">
          <div className="bg-blue-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">生成隨堂考</h3>
          <p className="text-gray-600 text-sm">
            AI 自動產生選擇題和簡答題，幫助你測試理解程度
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-shadow">
          <div className="bg-purple-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
            <BookOpen className="h-6 w-6 text-purple-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">生成閃卡</h3>
          <p className="text-gray-600 text-sm">
            提取關鍵術語和定義，製作精美閃卡方便快速複習
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-shadow">
          <div className="bg-green-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
            <Brain className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">畫重點 TL;DR</h3>
          <p className="text-gray-600 text-sm">
            為長篇文件生成核心摘要，快速掌握重點
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">上傳學習材料</h2>
        <FileUpload
          onFileSelect={handleFileSelect}
          uploading={uploading}
          selectedFile={selectedFile}
          onClear={() => setSelectedFile(null)}
        />
        {selectedFile && !uploading && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleUpload}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg shadow-blue-200"
            >
              開始處理 ✨
            </button>
          </div>
        )}
      </div>

      {/* Documents List */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">我的文件</h2>
        {loading ? (
          <LoadingSpinner message="載入文件中..." />
        ) : documents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">還沒有上傳任何文件</p>
            <p className="text-gray-400 text-sm mt-1">上傳你的第一份學習材料開始吧！</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default HomePage;
