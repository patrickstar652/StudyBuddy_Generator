import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileSearch,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Tag,
  RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner, { LoadingButton } from '../components/LoadingSpinner';
import { documentApi, studyApi } from '../services/api';

function SummaryPage() {
  const { docId } = useParams();
  const [document, setDocument] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedPoints, setExpandedPoints] = useState({});
  const [numPoints, setNumPoints] = useState(5);

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

  const generateSummary = async () => {
    setGenerating(true);
    setSummary(null);
    try {
      const result = await studyApi.generateSummary(docId, { num_points: numPoints });
      if (result.summary.error) {
        toast.error(result.summary.error);
      } else {
        setSummary(result.summary);
        toast.success('摘要生成成功！');
      }
    } catch (error) {
      console.error('Failed to generate summary:', error);
      toast.error('生成摘要失敗');
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
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getImportanceLabel = (importance) => {
    switch (importance) {
      case 'high':
        return '重要';
      case 'medium':
        return '中等';
      case 'low':
        return '一般';
      default:
        return importance;
    }
  };

  if (loading) {
    return <LoadingSpinner message="載入中..." />;
  }

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
          <div className="bg-green-500 p-4 rounded-2xl">
            <FileSearch className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">畫重點 TL;DR</h1>
            <p className="text-gray-500">{document?.original_filename}</p>
          </div>
        </div>
      </div>

      {/* Generate Section */}
      {!summary && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <FileSearch className="h-16 w-16 text-green-200 mx-auto mb-6" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            讓 AI 幫你畫重點
          </h2>
          <p className="text-gray-500 mb-6">
            快速掌握長篇文件的核心內容，節省閱讀時間
          </p>
          <div className="flex items-center justify-center gap-4 mb-6">
            <label className="text-gray-600">摘要要點：</label>
            <select
              value={numPoints}
              onChange={(e) => setNumPoints(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
            className="px-8 py-4 bg-gradient-to-r from-green-600 to-teal-600 text-white font-medium rounded-xl hover:from-green-700 hover:to-teal-700 transition-all shadow-lg"
          >
            生成摘要 ✨
          </LoadingButton>
        </div>
      )}

      {/* Summary Display */}
      {summary && (
        <div className="space-y-6">
          {/* TL;DR */}
          <div className="bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl p-8 text-white">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="h-6 w-6 flex-shrink-0" />
              <h2 className="text-xl font-bold">TL;DR (太長不讀)</h2>
            </div>
            <p className="text-lg leading-relaxed opacity-95">{summary.tldr}</p>
          </div>

          {/* Document Title */}
          {summary.document_title && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {summary.document_title}
              </h3>
            </div>
          )}

          {/* Key Points */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">核心重點</h3>
              <button
                onClick={() => setSummary(null)}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
              >
                <RotateCcw className="h-4 w-4" />
                重新生成
              </button>
            </div>
            <div className="space-y-4">
              {summary.key_points?.map((point, idx) => (
                <div
                  key={point.id || idx}
                  className="border border-gray-200 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => togglePoint(point.id || idx)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold">
                        {idx + 1}
                      </div>
                      <div className="text-left">
                        <h4 className="font-semibold text-gray-900">
                          {point.title}
                        </h4>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {point.importance && (
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full border ${getImportanceColor(
                            point.importance
                          )}`}
                        >
                          {getImportanceLabel(point.importance)}
                        </span>
                      )}
                      {expandedPoints[point.id || idx] ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </button>
                  {expandedPoints[point.id || idx] && (
                    <div className="px-4 pb-4">
                      <div className="pl-12">
                        <p className="text-gray-600">{point.description}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Keywords */}
          {summary.keywords && summary.keywords.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Tag className="h-5 w-5 text-gray-400" />
                關鍵詞
              </h3>
              <div className="flex flex-wrap gap-2">
                {summary.keywords.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    {keyword}
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
