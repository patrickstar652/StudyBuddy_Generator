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
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner, { LoadingButton } from '../components/LoadingSpinner';
import { documentApi, studyApi } from '../services/api';

function FlashcardsPage() {
  const { docId } = useParams();
  const [document, setDocument] = useState(null);
  const [flashcards, setFlashcards] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [numCards, setNumCards] = useState(10);

  useEffect(() => {
    fetchDocument();
  }, [docId]);

  const fetchDocument = async () => {
    try {
      const data = await documentApi.get(docId);
      setDocument(data.document);
    } catch (error) {
      console.error('Failed to fetch document:', error);
      toast.error('無法載入文件');
    } finally {
      setLoading(false);
    }
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
        toast.success('閃卡生成成功！');
      }
    } catch (error) {
      console.error('Failed to generate flashcards:', error);
      toast.error('生成閃卡失敗');
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
    toast.success('已打亂順序');
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

  if (loading) {
    return <LoadingSpinner message="載入中..." />;
  }

  const card = flashcards?.cards?.[currentCard];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link
          to={`/document/${docId}`}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          返回文件
        </Link>
        <div className="flex items-center gap-4">
          <div className="bg-purple-500 p-4 rounded-2xl">
            <Layers className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">閃卡複習</h1>
            <p className="text-gray-500">{document?.original_filename}</p>
          </div>
        </div>
      </div>

      {/* Generate Section */}
      {!flashcards && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Layers className="h-16 w-16 text-purple-200 mx-auto mb-6" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            準備好複習了嗎？
          </h2>
          <p className="text-gray-500 mb-6">
            AI 將從文件中提取關鍵概念，製作成方便複習的閃卡
          </p>
          <div className="flex items-center justify-center gap-4 mb-6">
            <label className="text-gray-600">閃卡數量：</label>
            <select
              value={numCards}
              onChange={(e) => setNumCards(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
          >
            生成閃卡 ✨
          </LoadingButton>
        </div>
      )}

      {/* Flashcard Display */}
      {flashcards && card && (
        <div className="space-y-6">
          {/* Progress & Controls */}
          <div className="flex items-center justify-between">
            <span className="text-gray-500">
              {currentCard + 1} / {flashcards.cards.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShuffle}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="打亂順序"
              >
                <Shuffle className="h-5 w-5 text-gray-500" />
              </button>
              <button
                onClick={() => {
                  setFlashcards(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="重新生成"
              >
                <RotateCcw className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Card */}
          <div className="flashcard-container">
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className={`flashcard cursor-pointer ${isFlipped ? 'flipped' : ''}`}
              style={{ minHeight: '300px' }}
            >
              {/* Front */}
              <div className="flashcard-front absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-8 flex flex-col items-center justify-center text-white">
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-4">{card.front}</h3>
                  {card.category && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 rounded-full text-sm">
                      <Tag className="h-3 w-3" />
                      {card.category}
                    </span>
                  )}
                </div>
                <p className="absolute bottom-4 text-white/60 text-sm">
                  點擊翻轉
                </p>
              </div>

              {/* Back */}
              <div className="flashcard-back absolute inset-0 bg-white rounded-2xl border-2 border-purple-200 p-8 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-lg text-gray-700">{card.back}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handlePrev}
              className="p-4 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              <ChevronLeft className="h-6 w-6 text-gray-600" />
            </button>
            <button
              onClick={handleNext}
              className="p-4 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              <ChevronRight className="h-6 w-6 text-gray-600" />
            </button>
          </div>

          {/* Keyboard Hint */}
          <p className="text-center text-gray-400 text-sm">
            使用 ← → 鍵切換卡片，空白鍵翻轉
          </p>

          {/* All Cards Preview */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">所有閃卡</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {flashcards.cards.map((c, idx) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCurrentCard(idx);
                    setIsFlipped(false);
                  }}
                  className={`p-4 rounded-xl text-left transition-all ${
                    idx === currentCard
                      ? 'bg-purple-100 border-2 border-purple-500'
                      : 'bg-gray-50 border-2 border-transparent hover:border-purple-200'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">
                    {c.front}
                  </p>
                  {c.category && (
                    <span className="text-xs text-gray-500 mt-1 block">
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
