import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileSearch,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Tag,
  RotateCcw,
  Sparkles,
  History,
  Clock,
  Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner, { LoadingButton } from '../components/LoadingSpinner';
import { documentApi, studyApi } from '../services/api';

function SummaryPage() {
  const { docId } = useParams();
  const [document, setDocument] = useState(null);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedPoints, setExpandedPoints] = useState({});
  const [numPoints, setNumPoints] = useState(5);
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
      const data = await studyApi.getSummaries(docId);
      setHistory(data.summaries || []);
      // 如果有歷史記錄，自動載入最新的一筆
      if (data.summaries && data.summaries.length > 0) {
        const latest = data.summaries[0];
        setSummary({
          document_title: latest.document_title,
          tldr: latest.tldr,
          key_points: latest.key_points,
          keywords: latest.keywords,
        });
      }
    } catch (error) {
      console.error('Failed to fetch summary history:', error);
    }
  };

  const loadFromHistory = (item) => {
    setSummary({
      document_title: item.document_title,
      tldr: item.tldr,
      key_points: item.key_points,
      keywords: item.keywords,
    });
    setExpandedPoints({});
    setShowHistory(false);
    toast.success('已載入歷史摘要');
  };

  const generateSummary = async () => {
    setGenerating(true);
    setSummary(null);
    try {
      const result = await studyApi.generateSummary(docId, { num_points: numPoints });
      if (result.summary.error) {
        toast.error(result.summary.error);
      } else {
        setSummary(result.summary);
        toast.success('Summary compiled successfully');
        // 重新載入歷史
        fetchHistory();
      }
    } catch (error) {
      console.error('Failed to generate summary:', error);
      toast.error('Summary compilation failed');
    } finally {
      setGenerating(false);
    }
  };

  const togglePoint = (id) => {
    setExpandedPoints((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getImportanceColor = (importance) => {
    switch (importance) {
      case 'high':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'low':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

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
    return <LoadingSpinner message="正在掃描數據模式..." />;
  }

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
            <div className="bg-green-100 dark:bg-green-500/10 p-4 rounded-2xl border border-green-200 dark:border-green-500/20 animate-pulse shadow-sm dark:shadow-none">
              <FileSearch className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
                重點摘要 <span className="text-xs bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 px-2 py-1 rounded-full border border-green-200 dark:border-green-500/20">TL;DR</span>
              </h1>
              <p className="text-slate-600 dark:text-slate-500 mt-1">{document?.original_filename}</p>
            </div>
          </div>
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                showHistory
                  ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
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
        <div className="glass-card rounded-2xl p-6 border border-green-200 dark:border-green-500/20 animate-fade-in">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-green-500" />
            摘要歷史記錄
          </h3>
          <div className="grid gap-3">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => loadFromHistory(item)}
                className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-white/5 hover:border-green-300 dark:hover:border-green-500/30 hover:bg-green-50 dark:hover:bg-green-500/5 transition-all text-left"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {item.document_title || '摘要'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {item.key_points?.length || 0} 個重點 · {formatDate(item.created_at)}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Generate Section */}
      {!summary && !generating && (
        <div className="glass-card rounded-2xl p-12 text-center border-dashed border-2 border-slate-300 dark:border-slate-700 animate-scale-in">
          <div className="bg-green-100 dark:bg-green-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 animate-float">
            <Sparkles className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            啟動內容提煉
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-lg mx-auto">
            即時提取複雜文件的核心智慧，節省數小時的處理時間。
          </p>
          <div className="flex items-center justify-center gap-4 mb-8">
            <label className="text-slate-700 dark:text-slate-300">提取密度：</label>
            <select
              value={numPoints}
              onChange={(e) => setNumPoints(parseInt(e.target.value))}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-slate-900 dark:text-slate-200"
            >
              {[3, 5, 7, 10].map((n) => (
                <option key={n} value={n}>
                  {n} 個重點
                </option>
              ))}
            </select>
          </div>
          <LoadingButton
            onClick={generateSummary}
            loading={generating}
            className="px-8 py-4 bg-gradient-to-r from-green-600 to-teal-600 text-white font-bold rounded-xl hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all relative overflow-hidden group"
          >
            <span className="relative z-10">生成摘要</span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </LoadingButton>
        </div>
      )}

      {/* Summary Display */}
      {summary && (
        <div className="space-y-6 animate-fade-in-up">
          {/* TL;DR */}
          <div className="relative overflow-hidden rounded-2xl p-8 animate-scale-in shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-green-600 to-teal-800 opacity-90" />
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 text-green-100 flex-shrink-0" />
                  <h2 className="text-xl font-bold text-white">執行摘要 (TL;DR)</h2>
                </div>
                <button
                  onClick={() => setSummary(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-green-100 hover:text-white"
                  title="生成新摘要"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
              <p className="text-lg leading-relaxed text-green-50 text-shadow-sm">{summary.tldr}</p>
            </div>
          </div>

          {/* Key Points */}
          <div className="glass-card rounded-2xl p-8 animate-fade-in-up delay-100 border border-slate-200 dark:border-white/5">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">核心智慧</h3>
              <button
                onClick={() => setSummary(null)}
                className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                重新生成
              </button>
            </div>
            <div className="space-y-4">
              {summary.key_points?.map((point, idx) => (
                <div
                  key={point.id || idx}
                  className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden hover:border-green-400/50 dark:hover:border-green-500/30 transition-colors animate-fade-in-up"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <button
                    onClick={() => togglePoint(point.id || idx)}
                    className="w-full flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded-lg flex items-center justify-center font-bold font-mono border border-green-200 dark:border-green-500/20">
                        {idx + 1}
                      </div>
                      <div className="text-left">
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-lg">
                          {point.title}
                        </h4>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {point.importance && (
                        <span
                          className={`px-3 py-1 text-xs font-bold rounded-full border uppercase tracking-wider ${getImportanceColor(
                            point.importance
                          )}`}
                        >
                          {point.importance}
                        </span>
                      )}
                      {expandedPoints[point.id || idx] ? (
                        <ChevronUp className="h-5 w-5 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                  </button>
                  {expandedPoints[point.id || idx] && (
                    <div className="px-5 pb-5 pt-0 animate-fade-in">
                      <div className="pl-12 border-l-2 border-slate-200 dark:border-slate-700 ml-4">
                        <p className="text-slate-600 dark:text-slate-400 pl-4 leading-relaxed">{point.description}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Keywords */}
          {summary.keywords && summary.keywords.length > 0 && (
            <div className="glass-card rounded-2xl p-8 animate-fade-in-up delay-200 border border-slate-200 dark:border-white/5">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
                <Tag className="h-5 w-5 text-green-600 dark:text-green-400" />
                語義標籤
              </h3>
              <div className="flex flex-wrap gap-2">
                {summary.keywords.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-full text-sm font-medium hover:border-green-400 hover:text-green-600 dark:hover:text-green-400 transition-all cursor-default hover:scale-105"
                  >
                    #{keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SummaryPage;
