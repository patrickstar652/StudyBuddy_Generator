const isRecord = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const asText = (value, fallback = '') => {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const asId = (value, fallback) => asText(value, fallback);

const normalizeQuestion = (value, index) => {
  const question = parseMaybeJson(value);
  if (!isRecord(question)) return null;

  const prompt = asText(question.question);
  if (!prompt) return null;

  const id = asId(question.id, `question-${index + 1}`);
  const explanation = asText(question.explanation);

  if (question.type === 'multiple_choice') {
    const rawOptions = parseMaybeJson(question.options);
    if (!Array.isArray(rawOptions)) return null;

    const options = rawOptions.map((option) => asText(option)).filter(Boolean);
    if (options.length < 2 || options.length > 26) return null;

    const correctAnswer = asText(question.correct_answer).charAt(0).toUpperCase();
    const validAnswers = options.map((_, optionIndex) => (
      String.fromCharCode(65 + optionIndex)
    ));
    if (!validAnswers.includes(correctAnswer)) return null;

    return {
      id,
      type: 'multiple_choice',
      question: prompt,
      options,
      correct_answer: correctAnswer,
      explanation,
    };
  }

  if (question.type === 'short_answer') {
    return {
      id,
      type: 'short_answer',
      question: prompt,
      expected_answer: asText(question.expected_answer, '未提供參考答案'),
      explanation,
    };
  }

  return null;
};

export const normalizeQuiz = (value) => {
  const quiz = parseMaybeJson(value);
  if (!isRecord(quiz)) return null;

  const rawQuestions = parseMaybeJson(quiz.questions);
  if (!Array.isArray(rawQuestions)) return null;

  const questions = rawQuestions
    .map(normalizeQuestion)
    .filter(Boolean);
  if (questions.length === 0) return null;

  return {
    quiz_title: asText(quiz.quiz_title, '自動生成測驗'),
    questions,
  };
};

export const normalizeQuizHistory = (value) => {
  const history = parseMaybeJson(value);
  if (!Array.isArray(history)) return [];

  return history.flatMap((rawItem, index) => {
    const item = parseMaybeJson(rawItem);
    if (!isRecord(item)) return [];

    const quiz = normalizeQuiz({
      quiz_title: item.title,
      questions: item.questions,
    });
    if (!quiz) return [];

    return [{
      id: asId(item.id, `quiz-history-${index + 1}`),
      title: quiz.quiz_title,
      questions: quiz.questions,
      created_at: asText(item.created_at),
    }];
  });
};

const normalizeCard = (value, index) => {
  const card = parseMaybeJson(value);
  if (!isRecord(card)) return null;

  const front = asText(card.front);
  const back = asText(card.back);
  if (!front || !back) return null;

  return {
    id: asId(card.id, `card-${index + 1}`),
    front,
    back,
    category: asText(card.category),
  };
};

export const normalizeFlashcards = (value) => {
  const deck = parseMaybeJson(value);
  if (!isRecord(deck)) return null;

  const rawCards = parseMaybeJson(deck.cards);
  if (!Array.isArray(rawCards)) return null;

  const cards = rawCards.map(normalizeCard).filter(Boolean);
  if (cards.length === 0) return null;

  return {
    deck_title: asText(deck.deck_title, '自動生成閃卡'),
    cards,
  };
};

export const normalizeFlashcardHistory = (value) => {
  const history = parseMaybeJson(value);
  if (!Array.isArray(history)) return [];

  return history.flatMap((rawItem, index) => {
    const item = parseMaybeJson(rawItem);
    if (!isRecord(item)) return [];

    const deck = normalizeFlashcards({
      deck_title: item.deck_title,
      cards: item.cards,
    });
    if (!deck) return [];

    return [{
      id: asId(item.id, `flashcard-history-${index + 1}`),
      deck_title: deck.deck_title,
      cards: deck.cards,
      created_at: asText(item.created_at),
    }];
  });
};

const normalizeKeyPoint = (value, index) => {
  const parsedValue = parseMaybeJson(value);
  if (typeof parsedValue === 'string') {
    const title = asText(parsedValue);
    return title ? {
      id: `point-${index + 1}`,
      title,
      description: '',
      importance: '',
    } : null;
  }
  if (!isRecord(parsedValue)) return null;

  const title = asText(parsedValue.title);
  const description = asText(parsedValue.description);
  if (!title && !description) return null;

  const importance = ['high', 'medium', 'low'].includes(parsedValue.importance)
    ? parsedValue.importance
    : '';

  return {
    id: asId(parsedValue.id, `point-${index + 1}`),
    title: title || `重點 ${index + 1}`,
    description,
    importance,
  };
};

const normalizeKeywords = (value) => {
  const parsedValue = parseMaybeJson(value);
  const candidates = Array.isArray(parsedValue)
    ? parsedValue
    : typeof parsedValue === 'string'
      ? parsedValue.split(/[,;；、\n]+/)
      : [];

  return [...new Set(candidates.map((keyword) => asText(keyword)).filter(Boolean))];
};

export const normalizeSummary = (value) => {
  const summary = parseMaybeJson(value);
  if (!isRecord(summary)) return null;

  const rawPoints = parseMaybeJson(summary.key_points);
  const keyPoints = Array.isArray(rawPoints)
    ? rawPoints.map(normalizeKeyPoint).filter(Boolean)
    : [];
  const providedTldr = asText(summary.tldr);
  const fallbackTldr = keyPoints[0]?.description || keyPoints[0]?.title || '';
  const tldr = providedTldr || fallbackTldr;
  if (!tldr && keyPoints.length === 0) return null;

  return {
    document_title: asText(summary.document_title, '文件摘要'),
    tldr,
    key_points: keyPoints,
    keywords: normalizeKeywords(summary.keywords),
  };
};

export const normalizeSummaryHistory = (value) => {
  const history = parseMaybeJson(value);
  if (!Array.isArray(history)) return [];

  return history.flatMap((rawItem, index) => {
    const item = parseMaybeJson(rawItem);
    if (!isRecord(item)) return [];

    const summary = normalizeSummary(item);
    if (!summary) return [];

    return [{
      id: asId(item.id, `summary-history-${index + 1}`),
      ...summary,
      created_at: asText(item.created_at),
    }];
  });
};
