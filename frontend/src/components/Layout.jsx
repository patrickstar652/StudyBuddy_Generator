import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { BookOpen, Home, GraduationCap, Sparkles, Sun, Moon } from 'lucide-react';

function Layout({ children }) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen text-slate-200 selection:bg-cyan-500/30">
      
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] animate-float opacity-50 dark:opacity-100 transition-opacity duration-300" />
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] animate-float opacity-50 dark:opacity-100 transition-opacity duration-300" style={{ animationDelay: '-3s' }} />
      </div>

      {/* Header */}
      <header className="fixed top-4 left-4 right-4 z-50">
        <div className="max-w-7xl mx-auto">
          <div className="glass-card rounded-2xl px-6 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 rounded-xl blur opacity-50 group-hover:opacity-100 transition duration-300" />
                <div className="relative bg-slate-900 border border-white/10 p-2 rounded-xl">
                  <GraduationCap className="h-6 w-6 text-cyan-400" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-cyan-400 dark:to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
                  Study Buddy <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">AI 智慧學習助手</p>
              </div>
            </Link>

            <nav className="flex items-center gap-4">
              <Link
                to="/"
                className={`relative px-4 py-2 rounded-xl transition-all duration-300 ${
                  location.pathname === '/'
                    ? 'bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-cyan-400 shadow-sm dark:shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">首頁</span>
                </div>
              </Link>

              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 transition-all duration-300 shadow-sm"
                title={theme === 'dark' ? '切換亮色模式' : '切換暗色模式'}
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5 text-yellow-400" />
                ) : (
                  <Moon className="h-5 w-5 text-slate-700" />
                )}
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-white/5 mt-auto bg-white/80 dark:bg-slate-950/50 backdrop-blur-lg transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-slate-600 dark:text-slate-500 text-sm font-medium">
            Powered by <span className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-cyan-400 dark:to-purple-400 bg-clip-text text-transparent font-semibold">Cosmic Intelligence</span> ✨
            <br />
            由宇宙智慧驅動
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
