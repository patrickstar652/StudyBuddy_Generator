import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  CheckCircle,
  XCircle,
  RotateCcw,
  ChevronRight,
  Settings,
  History,
  Clock,
  Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner, { LoadingButton } from '../components/LoadingSpinner';
import {
  documentApi,
  getApiErrorMessage,
  isRequestCanceled,
  studyApi,
} from '../services/api';
import { normalizeQuiz, normalizeQuizHistory } from '../utils/studyData';

function QuizPage() {
  const { docId } = useParams();
  const [document, setDocument] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [settings, setSettings] = useState({
    numQuestions: 5,
    questionType: 'mixed',
  });
  const requestSequenceRef = useRef(0);
  const generationControllerRef = useRef(null);

  const fetchDocument = useCallback(async (signal, requestId) => {
    try {
      const data = await documentApi.get(docId, { signal });
      if (signal.aborted || requestSequenceRef.current !== requestId) return;
      setDocument(data.document);
    } catch (error) {
      if (isRequestCanceled(error) || requestSequenceRef.current !== requestId) return;
      console.error('Failed to fetch document:', error);
      toast.error(getApiErrorMessage(error, '無法載入文件'));
    } finally {
      if (!signal.aborted && requestSequenceRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [docId]);

  const fetchHistory = useCallback(async (
    loadLatest = false,
    signal,
    requestId = requestSequenceRef.current,
  ) => {
    try {
      const data = await studyApi.getQuizzes(docId, { signal });
      if (signal?.aborted || requestSequenceRef.current !== requestId) return;

      const normalizedHistory = normalizeQuizHistory(data?.quizzes);
      setHistory(normalizedHistory);
      if (loadLatest && normalizedHistory.length > 0) {
        const latest = normalizedHistory[0];
        setQuiz((current) => current ?? {
          quiz_title: latest.title,
          questions: latest.questions,
        });
      }
    } catch (error) {
      if (isRequestCanceled(error) || requestSequenceRef.current !== requestId) return;
      console.error('Failed to fetch quiz history:', error);
    }
  }, [docId]);

  useEffect(() => {
    const requestId = ++requestSequenceRef.current;
    const controller = new AbortController();

    generationControllerRef.current?.abort();
    generationControllerRef.current = null;
    setDocument(null);
    setQuiz(null);
    setHistory([]);
    setLoading(true);
    setGenerating(false);
    setCurrentQuestion(0);
    setAnswers({});
    setShowResults(false);
    setShowSettings(false);
    setShowHistory(false);
    setSettings({ numQuestions: 5, questionType: 'mixed' });

    fetchDocument(controller.signal, requestId);
    fetchHistory(true, controller.signal, requestId);

    return () => {
      controller.abort();
      generationControllerRef.current?.abort();
      generationControllerRef.current = null;
      requestSequenceRef.current = requestId + 1;
    };
  }, [fetchDocument, fetchHistory]);

  const loadFromHistory = (item) => {
    const normalizedQuiz = normalizeQuiz({
      quiz_title: item.title,
      questions: item.questions,
    });
    if (!normalizedQuiz) {
      toast.error('這筆歷史測驗資料已損毀，無法載入');
      return;
    }

    setQuiz(normalizedQuiz);
    setAnswers({});
    setCurrentQuestion(0);
    setShowResults(false);
    setShowHistory(false);
    toast.success('已載入歷史測驗');
  };

  const generateQuiz = async () => {
    generationControllerRef.current?.abort();
    const controller = new AbortController();
    const requestId = requestSequenceRef.current;
    generationControllerRef.current = controller;
    setGenerating(true);
    setQuiz(null);
    setAnswers({});
    setCurrentQuestion(0);
    setShowResults(false);
    try {
      const result = await studyApi.generateQuiz(docId, {
        num_questions: settings.numQuestions,
        question_type: settings.questionType,
      }, { signal: controller.signal });
      if (controller.signal.aborted || requestSequenceRef.current !== requestId) return;

      if (result?.quiz?.error) {
        toast.error(result.quiz.error);
      } else {
        const normalizedQuiz = normalizeQuiz(result?.quiz);
        if (!normalizedQuiz) {
          toast.error('伺服器回傳了無效的測驗資料');
          return;
        }

        setQuiz(normalizedQuiz);
        toast.success('Simulation ready');
        await fetchHistory(false, controller.signal, requestId);
      }
    } catch (error) {
      if (isRequestCanceled(error) || requestSequenceRef.current !== requestId) return;
      console.error('Failed to generate quiz:', error);
      toast.error(getApiErrorMessage(error, '測驗生成失敗'));
    } finally {
      if (
        !controller.signal.aborted
        && requestSequenceRef.current === requestId
        && generationControllerRef.current === controller
      ) {
        generationControllerRef.current = null;
        setGenerating(false);
      }
    }
  };

  const handleAnswer = (questionId, answer) => {
    setAnswers((current) => ({ ...current, [questionId]: answer }));
  };

  const calculateScore = () => {
    if (!quiz?.questions) {
      return { correct: 0, total: 0, shortAnswerCount: 0, percentage: null };
    }

    let correct = 0;
    let total = 0;
    quiz.questions.forEach((question, index) => {
      if (question.type !== 'multiple_choice') return;

      total++;
      const questionKey = question.id ?? index;
      const selectedAnswer = String(answers[questionKey] || '').trim().charAt(0).toUpperCase();
      const correctAnswer = String(question.correct_answer || '').trim().charAt(0).toUpperCase();
      if (selectedAnswer && selectedAnswer === correctAnswer) {
        correct++;
      }
    });

    return {
      correct,
      total,
      shortAnswerCount: quiz.questions.length - total,
      percentage: total > 0 ? Math.round((correct / total) * 100) : null,
    };
  };

  const formatDate = (dateString) => {
    if (!dateString) return '時間未知';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '時間未知';
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <LoadingSpinner message="正在校準評估矩陣..." />;
  }

  if (!document) {
    return (
      <div className="text-center py-24 glass-card rounded-3xl animate-scale-in">
        <p className="text-slate-500 dark:text-slate-400 text-lg">找不到文件或文件暫時無法載入</p>
        <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline mt-4 inline-block font-medium">
          返回首頁
        </Link>
      </div>
    );
  }

  const question = quiz?.questions?.[currentQuestion];
  const questionKey = question?.id ?? currentQuestion;
  const score = calculateScore();

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
            <div className="bg-blue-100 dark:bg-blue-500/10 p-4 rounded-2xl border border-blue-200 dark:border-blue-500/20 animate-pulse shadow-sm dark:shadow-none">
              <ClipboardList className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-1">知識驗證</h1>
              <p className="text-slate-600 dark:text-slate-500">{document?.original_filename}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  showHistory
                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                } border border-slate-200 dark:border-slate-700`}
              >
                <History className="h-4 w-4" />
                歷史 ({history.length})
              </button>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-none"
              title="設定"
            >
              <Settings className="h-5 w-5 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400" />
            </button>
          </div>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && history.length > 0 && (
        <div className="glass-card rounded-2xl p-6 border border-blue-200 dark:border-blue-500/20 animate-fade-in">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            測驗歷史記錄
          </h3>
          <div className="grid gap-3">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => loadFromHistory(item)}
                className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/5 hover:border-blue-300 dark:hover:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/5 transition-all text-left"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {item.title || '測驗'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {item.questions?.length || 0} 題 · {formatDate(item.created_at)}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="glass-card rounded-xl p-6 animate-scale-in border border-slate-200 dark:border-white/5">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4">模擬參數</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-2">
                題目數量
              </label>
              <select
                value={settings.numQuestions}
                onChange={(e) =>
                  setSettings({ ...settings, numQuestions: parseInt(e.target.value) })
                }
                disabled={generating}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-200"
              >
                {[5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} 題
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-2">
                題目類型
              </label>
              <select
                value={settings.questionType}
                onChange={(e) =>
                  setSettings({ ...settings, questionType: e.target.value })
                }
                disabled={generating}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-200"
              >
                <option value="mixed">混合模式</option>
                <option value="multiple_choice">僅選擇題</option>
                <option value="short_answer">僅簡答題</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Generate Button */}
      {!quiz && (
        <div className="glass-card rounded-2xl p-12 text-center border-dashed border-2 border-slate-300 dark:border-slate-700 animate-scale-in">
          <ClipboardList className="h-16 w-16 text-blue-600 dark:text-blue-400 mx-auto mb-6 animate-float" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            啟動技能驗證
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            AI 將根據攝入的數據生成 {settings.numQuestions} 個問題。
          </p>
          <LoadingButton
            onClick={generateQuiz}
            loading={generating}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all relative overflow-hidden group"
          >
            <span className="relative z-10">開始測驗</span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </LoadingButton>
        </div>
      )}

      {/* Quiz Content */}
      {quiz && !showResults && question && (
        <div className="glass-card rounded-2xl p-8 animate-fade-in-up border border-slate-200 dark:border-white/5">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600 dark:text-slate-400 font-mono">
                問題 <span className="text-blue-600 dark:text-blue-400 font-bold">{currentQuestion + 1}</span> / {quiz.questions.length}
              </span>
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-600 dark:text-slate-500">
                  已完成：{Object.keys(answers).length}
                </span>
                <button
                  onClick={() => {
                    setQuiz(null);
                    setAnswers({});
                    setShowResults(false);
                  }}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                  title="生成新測驗"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                style={{
                  width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Question */}
          <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/5 animate-fade-in">
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border ${
                question.type === 'multiple_choice'
                  ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
                  : 'bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20'
              }`}
            >
              {question.type === 'multiple_choice' ? '選擇題' : '簡答題'}
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
              {question.question}
            </h2>
          </div>

          {/* Options */}
          {question.type === 'multiple_choice' ? (
            <div className="space-y-4 mb-8">
              {question.options.map((option, idx) => {
                const optionLetter = String.fromCharCode(65 + idx);
                const optionLabel = String(option).replace(/^[A-Z][.)]\s*/i, '');
                const isSelected = answers[questionKey] === optionLetter;
                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(questionKey, optionLetter)}
                    className={`w-full text-left p-5 rounded-xl border transition-all duration-200 group relative overflow-hidden animate-fade-in-up ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md dark:shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className={`absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? 'opacity-100' : ''}`} />
                    <div className="relative flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold font-mono transition-colors ${
                        isSelected ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <span className={`font-medium text-lg ${isSelected ? 'text-blue-700 dark:text-blue-100' : 'text-slate-700 dark:text-slate-300'}`}>
                         {optionLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mb-8 animate-fade-in-up">
              <textarea
                value={answers[questionKey] || ''}
                onChange={(e) => handleAnswer(questionKey, e.target.value)}
                placeholder="在此輸入您的分析..."
                className="w-full h-40 px-6 py-4 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 custom-scrollbar"
              />
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-white/5">
            <button
              onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
              disabled={currentQuestion === 0}
              className="px-6 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              上一題
            </button>
            {currentQuestion < quiz.questions.length - 1 ? (
              <button
                onClick={() => setCurrentQuestion(currentQuestion + 1)}
                className="px-8 py-3 bg-slate-900 dark:bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl flex items-center gap-2 transition-all hover:scale-105"
              >
                下一題
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowResults(true)}
                className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition-all hover:scale-105 shadow-[0_0_20px_rgba(22,163,74,0.4)]"
              >
                完成驗證
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {quiz && showResults && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Score Summary */}
          <div className="glass-card rounded-2xl p-12 text-center relative overflow-hidden animate-scale-in border border-slate-200 dark:border-white/5">
             <div className="absolute inset-0 bg-blue-500/5" />
            <div className="relative z-10 mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">評估完成</h2>
              <div className="text-8xl font-black bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent p-4 drop-shadow-2xl animate-pulse">
                {score.percentage === null ? '—' : `${score.percentage}%`}
              </div>
              <p className="text-xl text-slate-600 dark:text-slate-400 mt-4">
                {score.total > 0 ? (
                  <>
                    選擇題： <span className="text-slate-900 dark:text-white font-bold">{score.correct}</span> / {score.total} 正確
                  </>
                ) : (
                  '本次測驗沒有可自動計分的選擇題'
                )}
              </p>
              {score.shortAnswerCount > 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
                  {score.shortAnswerCount} 題簡答題請依下方參考答案自行核對。
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setQuiz(null);
                setAnswers({});
                setShowResults(false);
              }}
              className="relative z-10 px-8 py-4 bg-slate-900 dark:bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl flex items-center gap-3 mx-auto transition-all hover:scale-105 border border-white/5"
            >
              <RotateCcw className="h-5 w-5" />
              重置模擬
            </button>
          </div>

          {/* Detailed Results */}
          <div className="glass-card rounded-2xl p-8 animate-fade-in-up delay-200 border border-slate-200 dark:border-white/5">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-8">分析矩陣</h3>
            <div className="space-y-6">
              {quiz.questions.map((q, idx) => {
                const itemKey = q.id ?? idx;
                const userAnswer = answers[itemKey];
                const normalizedUserAnswer = String(userAnswer || '').trim().charAt(0).toUpperCase();
                const normalizedCorrectAnswer = String(q.correct_answer || '').trim().charAt(0).toUpperCase();
                const isCorrect =
                  q.type === 'multiple_choice'
                  && Boolean(normalizedCorrectAnswer)
                  && normalizedUserAnswer === normalizedCorrectAnswer;

                return (
                  <div
                    key={itemKey}
                    className={`p-6 rounded-xl border border-l-4 transition-all duration-300 hover:scale-[1.01] ${
                      q.type === 'multiple_choice'
                        ? isCorrect
                          ? 'border-green-500/30 border-l-green-500 bg-green-50 dark:bg-green-500/5'
                          : 'border-red-500/30 border-l-red-500 bg-red-50 dark:bg-red-500/5'
                        : 'border-slate-200 dark:border-slate-700 border-l-blue-500 bg-white dark:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {q.type === 'multiple_choice' ? (
                        isCorrect ? (
                          <div className="p-2 bg-green-100 dark:bg-green-500/20 rounded-full flex-shrink-0 animate-scale-in">
                             <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                          </div>
                        ) : (
                          <div className="p-2 bg-red-100 dark:bg-red-500/20 rounded-full flex-shrink-0 animate-scale-in">
                             <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                          </div>
                        )
                      ) : (
                        <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-full flex-shrink-0">
                           <div className="h-6 w-6 rounded-full border-2 border-blue-500 dark:border-blue-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-lg text-slate-800 dark:text-slate-200 mb-4">
                          <span className="text-slate-500 mr-2">{idx + 1}.</span>
                          {q.question}
                        </p>
                        {q.type === 'multiple_choice' && (
                          <div className="space-y-3 bg-white dark:bg-slate-950/30 p-4 rounded-xl border border-slate-200 dark:border-white/5">
                            <p className="text-sm flex items-center justify-between">
                              <span className="text-slate-600 dark:text-slate-400">您的答案：</span>
                              <span className={`font-mono font-bold px-2 py-1 rounded ${isCorrect ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'}`}>
                                {userAnswer || 'N/A'}
                              </span>
                            </p>
                            {!isCorrect && (
                              <p className="text-sm flex items-center justify-between border-t border-slate-200 dark:border-white/5 pt-2">
                                <span className="text-slate-600 dark:text-slate-400">最佳答案：</span>
                                <span className="font-mono font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-500/10 px-2 py-1 rounded">{q.correct_answer}</span>
                              </p>
                            )}
                          </div>
                        )}
                        {q.type === 'short_answer' && (
                          <div className="space-y-4 bg-white dark:bg-slate-950/30 p-4 rounded-xl border border-slate-200 dark:border-white/5 mt-4">
                            <div>
                              <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">您的輸出</p>
                              <p className="text-slate-700 dark:text-slate-300 italic">{userAnswer || '無數據'}</p>
                            </div>
                            <div className="border-t border-slate-200 dark:border-white/5 pt-4">
                               <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">參考輸出</p>
                               <p className="text-green-700 dark:text-green-300/80">{q.expected_answer}</p>
                            </div>
                          </div>
                        )}
                        {q.explanation && (
                          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-500/5 rounded-xl border border-blue-200 dark:border-blue-500/20">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              <span className="font-bold text-blue-600 dark:text-blue-400 mr-2 uppercase text-xs tracking-wider">分析：</span> 
                              {q.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuizPage;
