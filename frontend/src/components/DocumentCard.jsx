import { Link } from 'react-router-dom';
import { FileText, Trash2, Calendar, Hash } from 'lucide-react';

function DocumentCard({ document, onDelete }) {
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow group">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-3 rounded-xl">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <Link
              to={`/document/${document.id}`}
              className="font-semibold text-gray-900 hover:text-blue-600 transition-colors block truncate"
            >
              {document.original_filename}
            </Link>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Hash className="h-4 w-4" />
                {document.total_tokens?.toLocaleString()} tokens
              </span>
              <span>{formatFileSize(document.file_size)}</span>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => onDelete(document.id)}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          title="刪除文件"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          document.status === 'ready'
            ? 'bg-green-100 text-green-700'
            : 'bg-yellow-100 text-yellow-700'
        }`}>
          {document.status === 'ready' ? '已就緒' : '處理中'}
        </span>
        <span className="text-xs text-gray-400">
          {document.total_chunks} 個區塊
        </span>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <Link
          to={`/document/${document.id}`}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          開始學習 →
        </Link>
      </div>
    </div>
  );
}

export default DocumentCard;
