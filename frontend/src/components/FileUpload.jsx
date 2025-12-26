import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X } from 'lucide-react';

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
      <div className="border-2 border-blue-200 bg-blue-50 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-sm text-gray-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          {!uploading && (
            <button
              onClick={onClear}
              className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          )}
        </div>
        {uploading && (
          <div className="mt-4">
            <div className="h-2 bg-blue-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full animate-pulse w-full" />
            </div>
            <p className="text-sm text-blue-600 mt-2">正在上傳並處理文件...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
        isDragActive
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-4">
        <div className={`p-4 rounded-full ${isDragActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
          <Upload className={`h-10 w-10 ${isDragActive ? 'text-blue-600' : 'text-gray-400'}`} />
        </div>
        <div>
          <p className="text-lg font-medium text-gray-700">
            {isDragActive ? '放開以上傳文件' : '拖放文件到此處'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            或點擊選擇文件 (支援 PDF, DOCX, TXT)
          </p>
        </div>
      </div>
    </div>
  );
}

export default FileUpload;
