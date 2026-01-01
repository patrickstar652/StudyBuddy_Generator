import { Loader2 } from 'lucide-react';

function LoadingSpinner({ message = 'Initializing Cosmic Link...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative w-24 h-24">
        {/* Core */}
        <div className="absolute inset-0 bg-blue-500 rounded-full opacity-20 animate-ping" />
        <div className="absolute inset-2 bg-purple-500 rounded-full opacity-20 animate-ping" style={{ animationDelay: '0.2s' }} />
        
        {/* Rings */}
        <div className="absolute inset-0 border-2 border-cyan-400/50 rounded-full animate-spin-slow" />
        <div className="absolute inset-4 border-2 border-purple-400/50 rounded-full animate-spin-slow" style={{ animationDirection: 'reverse' }} />
        
        {/* Center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-pulse" />
        </div>
      </div>
      <p className="mt-8 text-cyan-400 font-medium tracking-wider animate-pulse uppercase text-sm">
        {message}
      </p>
    </div>
  );
}

export function LoadingButton({ loading, children, ...props }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`relative overflow-hidden transition-all duration-300 ${props.className || ''}`}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Processing Protocol...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export default LoadingSpinner;
