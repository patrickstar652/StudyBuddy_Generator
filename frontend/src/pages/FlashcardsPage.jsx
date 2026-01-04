import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Layers,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Shuffle,
  Tag,
  Sparkles,
  History,
  Clock,
  Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner, { LoadingButton } from '../components/LoadingSpinner';
import { documentApi, studyApi } from '../services/api';

function FlashcardsPage() {
  const { docId } = useParams();
  const [document, setDocument] = useState(null);
  const [flashcards, setFlashcards] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [numCards, setNumCards] = useState(10);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchDocument();
    fetchHistory();
  }, [docId]);

  const fetchDocument = async () => {
    try {
      const data = await documentApi.get(docId);
      setDocument(data.document);
    } catch (error) {
      console.error('Failed to fetch document:', error);
      toast.error('Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await studyApi.getFlashcards(docId);
      setHistory(data.flashcards || []);
      // 如果有歷史記錄，自動載入最新的一筆
      if (data.flashcards && data.flashcards.length > 0) {
        const latest = data.flashcards[0];
        setFlashcards({
          deck_title: latest.deck_title,
          cards: latest.cards,
        });
      }
    } catch (error) {
      console.error('Failed to fetch flashcards history:', error);
    }
  };

  const loadFromHistory = (item) => {
    setFlashcards({
      deck_title: item.deck_title,
      cards: item.cards,
    });
    setCurrentCard(0);
    setIsFlipped(false);
    setShowHistory(false);
    toast.success('已載入歷史閃卡');
  };

  const generateFlashcards = async () => {
    setGenerating(true);
    setFlashcards(null);
    setCurrentCard(0);
    setIsFlipped(false);
    try {
      const result = await studyApi.generateFlashcards(docId, { num_cards: numCards });
      if (result.flashcards.error) {
        toast.error(result.flashcards.error);
      } else {
        setFlashcards(result.flashcards);
        toast.success('Flashcards generated successfully');
        // 重新載入歷史
        fetchHistory();
      }
    } catch (error) {
      console.error('Failed to generate flashcards:', error);
      toast.error('Flashcard generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentCard((prev) => (prev > 0 ? prev - 1 : flashcards.cards.length - 1));
  };

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentCard((prev) => (prev < flashcards.cards.length - 1 ? prev + 1 : 0));
  };

  const handleShuffle = () => {
    if (!flashcards?.cards) return;
    const shuffled = [...flashcards.cards].sort(() => Math.random() - 0.5);
    setFlashcards({ ...flashcards, cards: shuffled });
    setCurrentCard(0);
    setIsFlipped(false);
    toast.success('Deck shuffled');
  };

  const handleKeyPress = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      setIsFlipped(!isFlipped);
    } else if (e.key === 'ArrowLeft') {
      handlePrev();
    } else if (e.key === 'ArrowRight') {
      handleNext();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFlipped, flashcards, currentCard]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <LoadingSpinner message="正在加載神經牌組..." />;
  }

  const card = flashcards?.cards?.[currentCard];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <Link
          to={`/document/${docId}`}
          className="flex items-center gap-2 text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回文件
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="bg-purple-100 dark:bg-purple-500/10 p-4 rounded-2xl border border-purple-200 dark:border-purple-500/20 animate-pulse shadow-sm dark:shadow-none">
              <Layers className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
                閃卡複習
              </h1>
              <p className="text-slate-600 dark:text-slate-500 mt-1">{document?.original_filename}</p>
            </div>
          </div>
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                showHistory
                  ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              } border border-slate-200 dark:border-slate-700`}
            >
              <History className="h-4 w-4" />
              歷史記錄 ({history.length})
            </button>
          )}
        </div>
      </div>

      {/* History Panel */}
      {showHistory && history.length > 0 && (
        <div className="glass-card rounded-2xl p-6 border border-purple-200 dark:border-purple-500/20 animate-fade-in">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-500" />
            閃卡歷史記錄
          </h3>
          <div className="grid gap-3">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => loadFromHistory(item)}
                className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/5 hover:border-purple-300 dark:hover:border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-500/5 transition-all text-left"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {item.deck_title || '閃卡牌組'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {item.cards?.length || 0} 張卡片 · {formatDate(item.created_at)}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Generate Section - 顯示在有歷史記錄時變成「生成新閃卡」按鈕 */}
      {!flashcards && !generating && (
        <div className="glass-card rounded-2xl p-12 text-center border-dashed border-2 border-slate-300 dark:border-slate-700 animate-scale-in">
          <div className="bg-purple-100 dark:bg-purple-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 animate-float">
            <Sparkles className="h-10 w-10 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            準備好進行神經下載了嗎？
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-lg mx-auto">
            我們的 AI 將把核心概念整合成閃卡，助您快速吸收知識。
          </p>
          <div className="flex items-center justify-center gap-4 mb-8">
            <label className="text-slate-700 dark:text-slate-300">卡片數量：</label>
            <select
              value={numCards}
              onChange={(e) => setNumCards(parseInt(e.target.value))}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-slate-200"
            >
              {[5, 10, 15, 20].map((n) => (
                <option key={n} value={n}>
                  {n} 張
                </option>
              ))}
            </select>
          </div>
          <LoadingButton
            onClick={generateFlashcards}
            loading={generating}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all relative overflow-hidden group"
          >
            <span className="relative z-10">生成閃卡</span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </LoadingButton>
        </div>
      )}

      {/* Flashcard Display */}
      {flashcards && card && (
        <div className="space-y-8 animate-fade-in-up">
          {/* Progress & Controls */}
          <div className="flex items-center justify-between glass-card p-4 rounded-xl">
            <span className="text-slate-600 dark:text-slate-400 font-mono">
              卡片 <span className="text-purple-600 dark:text-purple-400 font-bold">{currentCard + 1}</span> / {flashcards.cards.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShuffle}
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400"
                title="洗牌"
              >
                <Shuffle className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  setFlashcards(null);
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400"
                title="生成新閃卡"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Card */}
          <div key={currentCard} className="flashcard-container max-w-2xl mx-auto h-[400px] animate-slide-in-right">
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className={`flashcard cursor-pointer w-full h-full relative ${isFlipped ? 'flipped' : ''}`}
            >
              {/* Front */}
              {/* Front */}
              <div className="flashcard-front holo-card flashcard-3d-glow absolute inset-0 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-900 rounded-3xl p-8 flex flex-col items-center border-t border-l border-slate-200 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-colors overflow-hidden">
                <div className="flex-1 flex flex-col items-center justify-center w-full z-10">
                  <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-6 leading-tight text-center drop-shadow-sm dark:drop-shadow-lg max-w-full break-words">
                    {card.front}
                  </h3>
                  {card.category && (
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-100 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-full text-sm text-purple-700 dark:text-purple-300 uppercase tracking-widest box-shadow-neon">
                      <Tag className="h-3 w-3" />
                      {card.category}
                    </span>
                  )}
                </div>
                <div className="absolute top-4 right-4 z-0">
                  <Sparkles className="h-5 w-5 text-purple-400 opacity-50" />
                </div>
                <div className="absolute bottom-4 right-4 text-purple-500/20 z-0">
                  <span className="text-6xl font-bold opacity-10">?</span>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 w-full flex justify-center z-10 bg-white/50 dark:bg-transparent rounded-b-xl">
                  <p className="text-slate-400 dark:text-slate-500 text-xs uppercase tracking-[0.2em] animate-pulse">
                    點擊翻開
                  </p>
                </div>
              </div>

              {/* Back */}
              <div className="flashcard-back holo-card flashcard-3d-glow absolute inset-0 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-indigo-950 dark:to-purple-950 rounded-3xl p-8 flex flex-col items-center justify-center text-center border border-purple-200 dark:border-white/10 shadow-[0_0_50px_rgba(168,85,247,0.1)] dark:shadow-[0_0_50px_rgba(168,85,247,0.2)] overflow-hidden">
                <div className="absolute inset-0 particle-bg opacity-30 rounded-3xl pointer-events-none" />
                <div className="flex-1 flex flex-col items-center justify-center w-full z-10 overflow-y-auto custom-scrollbar">
                  <div className="bg-white/80 dark:bg-black/20 p-6 rounded-2xl border border-purple-100 dark:border-white/5 shadow-sm">
                    <p className="text-xl md:text-2xl font-medium text-slate-900 dark:text-slate-100 leading-relaxed max-w-full break-words">
                      {card.back}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={handlePrev}
              className="p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl transition-all hover:scale-110 shadow-lg group border border-slate-200 dark:border-transparent"
            >
              <ChevronLeft className="h-8 w-8 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
            </button>
            <div className="text-slate-500 text-sm font-medium px-4">
              使用方向鍵或點擊按鈕
            </div>
            <button
              onClick={handleNext}
              className="p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-2xl transition-all hover:scale-110 shadow-lg group border border-slate-200 dark:border-transparent"
            >
              <ChevronRight className="h-8 w-8 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
            </button>
          </div>

          {/* All Cards Preview */}
          <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/5 p-8 mt-12 animate-fade-in delay-200">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-6 text-lg">完整牌組預覽</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {flashcards.cards.map((c, idx) => (
                <button
                  key={c.id || idx}
                  onClick={() => {
                    setCurrentCard(idx);
                    setIsFlipped(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`p-4 rounded-xl text-left transition-all ${
                    idx === currentCard
                      ? 'bg-purple-100 dark:bg-purple-500/20 border border-purple-300 dark:border-purple-500/50 shadow-md dark:shadow-[0_0_15px_rgba(168,85,247,0.2)] scale-105'
                      : 'bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 hover:border-purple-300 dark:hover:border-purple-500/30 hover:scale-105'
                  }`}
                >
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 line-clamp-2 mb-2">
                    {c.front}
                  </p>
                  {c.category && (
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
                      {c.category}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FlashcardsPage;
