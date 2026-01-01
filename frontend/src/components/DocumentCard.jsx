import { Link } from 'react-router-dom';
import { FileText, Trash2, Calendar, Hash, ArrowRight } from 'lucide-react';

function DocumentCard({ document, onDelete }) {
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  return (
    <div className="glass-card rounded-2xl p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg dark:hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] group relative overflow-hidden border border-slate-200 dark:border-white/5">
      {/* Decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 dark:bg-cyan-500/5 rounded-full blur-[40px] -mr-16 -mt-16 transition-opacity group-hover:opacity-100 opacity-50" />
      
      <div className="flex items-start justify-between relative z-10">
        <div className="flex items-start gap-4">
          <div className="bg-blue-50 dark:bg-slate-800 p-3 rounded-xl border border-blue-100 dark:border-white/5 shadow-sm dark:shadow-inner group-hover:border-blue-200 dark:group-hover:border-cyan-500/30 transition-colors">
            <FileText className="h-6 w-6 text-blue-600 dark:text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="overflow-hidden fade-mask w-full">
              <Link
                to={`/document/${document.id}`}
                className="flex w-fit animate-scroll hover:pause group/text"
              >
                <span className="font-semibold text-slate-900 dark:text-slate-100 group-hover/text:text-blue-600 dark:group-hover/text:text-cyan-400 transition-colors whitespace-nowrap mr-8 text-lg tracking-tight">
                  {document.original_filename}
                </span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 group-hover/text:text-blue-600 dark:group-hover/text:text-cyan-400 transition-colors whitespace-nowrap mr-8 text-lg tracking-tight">
                  {document.original_filename}
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                {document.total_tokens?.toLocaleString()} tokens
              </span>
              <span className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
              <span>{formatFileSize(document.file_size)}</span>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => onDelete(document.id)}
          className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          title="刪除文件"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
            document.status === 'ready'
              ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
              : 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20'
          }`}>
            {document.status === 'ready' ? '就緒' : '處理中'}
          </span>
          <span className="text-xs text-slate-500">
            {document.total_chunks} 塊區段
          </span>
        </div>

        <Link
          to={`/document/${document.id}`}
          className="text-sm text-blue-600 dark:text-cyan-400 hover:text-blue-500 dark:hover:text-cyan-300 font-medium flex items-center gap-1 group/link"
        >
          開始分析
          <ArrowRight className="h-4 w-4 transition-transform group-hover/link:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}

export default DocumentCard;
