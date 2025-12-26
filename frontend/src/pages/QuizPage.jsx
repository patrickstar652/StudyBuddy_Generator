import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  CheckCircle,
  XCircle,
  RotateCcw,
  ChevronRight,
  Settings,
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner, { LoadingButton } from '../components/LoadingSpinner';
import { documentApi, studyApi } from '../services/api';

function QuizPage() {
  const { docId } = useParams();
  const [document, setDocument] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    numQuestions: 5,
    questionType: 'mixed',
  });

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

  const generateQuiz = async () => {
    setGenerating(true);
    setQuiz(null);
    setAnswers({});
    setCurrentQuestion(0);
    setShowResults(false);
    try {
      const result = await studyApi.generateQuiz(docId, {
        num_questions: settings.numQuestions,
        question_type: settings.questionType,
      });
      if (result.quiz.error) {
        toast.error(result.quiz.error);
      } else {
        setQuiz(result.quiz);
        toast.success('測驗生成成功！');
      }
    } catch (error) {
      console.error('Failed to generate quiz:', error);
      toast.error('生成測驗失敗');
    } finally {
      setGenerating(false);
    }
  };

  const handleAnswer = (questionId, answer) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const calculateScore = () => {
    if (!quiz?.questions) return { correct: 0, total: 0 };
    
    let correct = 0;
    quiz.questions.forEach((q) => {
      if (q.type === 'multiple_choice' && answers[q.id] === q.correct_answer) {
        correct++;
      }
    });
    return { correct, total: quiz.questions.length };
  };

  if (loading) {
    return <LoadingSpinner message="載入中..." />;
  }

  const question = quiz?.questions?.[currentQuestion];
  const score = calculateScore();

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-500 p-4 rounded-2xl">
              <ClipboardList className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">隨堂考</h1>
              <p className="text-gray-500">{document?.original_filename}</p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-3 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <Settings className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">測驗設定</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                題目數量
              </label>
              <select
                value={settings.numQuestions}
                onChange={(e) =>
                  setSettings({ ...settings, numQuestions: parseInt(e.target.value) })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} 題
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                題目類型
              </label>
              <select
                value={settings.questionType}
                onChange={(e) =>
                  setSettings({ ...settings, questionType: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="mixed">混合題型</option>
                <option value="multiple_choice">只有選擇題</option>
                <option value="short_answer">只有簡答題</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Generate Button */}
      {!quiz && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <ClipboardList className="h-16 w-16 text-blue-200 mx-auto mb-6" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            準備好測試自己了嗎？
          </h2>
          <p className="text-gray-500 mb-6">
            AI 將根據文件內容生成 {settings.numQuestions} 道測驗題目
          </p>
          <LoadingButton
            onClick={generateQuiz}
            loading={generating}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
          >
            生成測驗 ✨
          </LoadingButton>
        </div>
      )}

      {/* Quiz Content */}
      {quiz && !showResults && question && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">
                題目 {currentQuestion + 1} / {quiz.questions.length}
              </span>
              <span className="text-sm text-gray-500">
                已作答 {Object.keys(answers).length} 題
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{
                  width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Question */}
          <div className="mb-8">
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-4 ${
                question.type === 'multiple_choice'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-purple-100 text-purple-700'
              }`}
            >
              {question.type === 'multiple_choice' ? '選擇題' : '簡答題'}
            </span>
            <h2 className="text-xl font-semibold text-gray-900">
              {question.question}
            </h2>
          </div>

          {/* Options */}
          {question.type === 'multiple_choice' ? (
            <div className="space-y-3 mb-8">
              {question.options.map((option, idx) => {
                const optionLetter = option.charAt(0);
                const isSelected = answers[question.id] === optionLetter;
                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(question.id, optionLetter)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all quiz-option ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-medium">{option}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mb-8">
              <textarea
                value={answers[question.id] || ''}
                onChange={(e) => handleAnswer(question.id, e.target.value)}
                placeholder="輸入你的答案..."
                className="w-full h-32 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
              disabled={currentQuestion === 0}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一題
            </button>
            {currentQuestion < quiz.questions.length - 1 ? (
              <button
                onClick={() => setCurrentQuestion(currentQuestion + 1)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                下一題
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowResults(true)}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                提交測驗
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {quiz && showResults && (
        <div className="space-y-6">
          {/* Score Summary */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <div className="mb-6">
              <div className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {Math.round((score.correct / score.total) * 100)}%
              </div>
              <p className="text-gray-500 mt-2">
                答對 {score.correct} / {score.total} 題
              </p>
            </div>
            <button
              onClick={() => {
                setQuiz(null);
                setAnswers({});
                setShowResults(false);
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2 mx-auto"
            >
              <RotateCcw className="h-4 w-4" />
              重新測驗
            </button>
          </div>

          {/* Detailed Results */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">詳細結果</h3>
            <div className="space-y-6">
              {quiz.questions.map((q, idx) => {
                const userAnswer = answers[q.id];
                const isCorrect =
                  q.type === 'multiple_choice' && userAnswer === q.correct_answer;

                return (
                  <div
                    key={q.id}
                    className={`p-6 rounded-xl border-2 ${
                      q.type === 'multiple_choice'
                        ? isCorrect
                          ? 'border-green-200 bg-green-50'
                          : 'border-red-200 bg-red-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-4">
                      {q.type === 'multiple_choice' ? (
                        isCorrect ? (
                          <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
                        )
                      ) : (
                        <div className="h-6 w-6 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {idx + 1}. {q.question}
                        </p>
                        {q.type === 'multiple_choice' && (
                          <div className="mt-3 space-y-2">
                            <p className="text-sm">
                              <span className="text-gray-500">你的答案：</span>{' '}
                              <span className={isCorrect ? 'text-green-600' : 'text-red-600'}>
                                {userAnswer || '未作答'}
                              </span>
                            </p>
                            {!isCorrect && (
                              <p className="text-sm">
                                <span className="text-gray-500">正確答案：</span>{' '}
                                <span className="text-green-600">{q.correct_answer}</span>
                              </p>
                            )}
                          </div>
                        )}
                        {q.type === 'short_answer' && (
                          <div className="mt-3 space-y-2">
                            <p className="text-sm">
                              <span className="text-gray-500">你的答案：</span>{' '}
                              {userAnswer || '未作答'}
                            </p>
                            <p className="text-sm">
                              <span className="text-gray-500">參考答案：</span>{' '}
                              {q.expected_answer}
                            </p>
                          </div>
                        )}
                        {q.explanation && (
                          <div className="mt-3 p-3 bg-white rounded-lg">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">解釋：</span> {q.explanation}
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
