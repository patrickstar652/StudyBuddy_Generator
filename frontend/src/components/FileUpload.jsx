import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Sparkles } from 'lucide-react';

function FileUpload({ onFileSelect, uploading, selectedFile, onClear }) {
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  if (selectedFile) {
    return (
      <div className="relative group overflow-hidden bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-blue-500/30 rounded-xl p-6 backdrop-blur-sm">
        <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 dark:bg-blue-500/20 p-3 rounded-xl border border-blue-200 dark:border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)] dark:shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <FileText className="h-8 w-8 text-blue-600 dark:text-cyan-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-cyan-50">{selectedFile.name}</p>
              <p className="text-sm text-slate-500 dark:text-cyan-300/60">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          {!uploading && (
            <button
              onClick={onClear}
              className="p-2 hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-red-500 dark:hover:text-red-400"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        {uploading && (
          <div className="mt-6 relative">
            <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 dark:from-cyan-500 dark:to-purple-500 rounded-full animate-pulse w-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
            </div>
            <p className="text-sm text-blue-600 dark:text-cyan-400 mt-2 flex items-center gap-2">
              <Sparkles className="h-3 w-3" />
              正在處理神經連線...
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`relative rounded-xl p-12 text-center cursor-pointer transition-all duration-300 group overflow-hidden ${
        isDragActive
          ? 'border-2 border-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/30 shadow-[0_0_30px_rgba(34,211,238,0.2)]'
          : 'border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50'
      }`}
    >
      <input {...getInputProps()} />
      
      {/* Glow Effect */}
      <div className={`absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      
      <div className="relative flex flex-col items-center gap-4 z-10">
        <div className={`p-4 rounded-2xl transition-all duration-300 ${
          isDragActive 
            ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.4)]' 
            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-400 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 group-hover:scale-110'
        }`}>
          <Upload className="h-10 w-10 py-1" />
        </div>
        <div>
          <p className="text-lg font-medium text-slate-700 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-200 transition-colors">
            {isDragActive ? '放開以初始化上行鏈路' : '拖放學習教材'}
          </p>
          <p className="text-sm text-slate-500 mt-2 group-hover:text-slate-600 dark:group-hover:text-slate-400">
            或點擊瀏覽數據庫 (PDF, DOCX, TXT)
          </p>
        </div>
      </div>
    </div>
  );
}

export default FileUpload;
