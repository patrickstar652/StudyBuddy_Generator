import { Loader2 } from 'lucide-react';

function LoadingSpinner({ message = '載入中...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-200 rounded-full"></div>
        <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
      </div>
      <p className="mt-4 text-gray-600">{message}</p>
    </div>
  );
}

export function LoadingButton({ loading, children, ...props }) {
  return (
    <button {...props} disabled={loading || props.disabled}>
      {loading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          處理中...
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export default LoadingSpinner;
