import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeFlashcardHistory,
  normalizeFlashcards,
  normalizeQuiz,
  normalizeQuizHistory,
  normalizeSummary,
  normalizeSummaryHistory,
} from '../src/utils/studyData.js';

test('normalizeQuiz drops malformed questions and rejects an empty usable quiz', () => {
  assert.equal(normalizeQuiz({ questions: [{ type: 'multiple_choice', options: null }] }), null);

  const quiz = normalizeQuiz({
    quiz_title: '安全測驗',
    questions: [
      {
        id: 1,
        type: 'multiple_choice',
        question: '有效題目',
        options: ['A. 一', 'B. 二'],
        correct_answer: 'B',
      },
      { type: 'multiple_choice', question: '壞題目', options: null },
    ],
  });

  assert.equal(quiz.questions.length, 1);
  assert.equal(quiz.questions[0].correct_answer, 'B');
});

test('normalizeQuizHistory accepts JSON text and filters invalid records', () => {
  const history = normalizeQuizHistory(JSON.stringify([
    {
      id: 'valid',
      title: '歷史測驗',
      questions: JSON.stringify([
        { type: 'short_answer', question: '說明內容' },
      ]),
    },
    { id: 'invalid', questions: null },
  ]));

  assert.equal(history.length, 1);
  assert.equal(history[0].questions[0].expected_answer, '未提供參考答案');
});

test('normalizeFlashcards rejects null or entirely malformed cards', () => {
  assert.equal(normalizeFlashcards({ cards: null }), null);
  assert.equal(normalizeFlashcards({ cards: [{ front: '只有正面' }] }), null);

  const deck = normalizeFlashcards({
    cards: [null, { front: '問題', back: '答案', category: 42 }],
  });
  assert.equal(deck.cards.length, 1);
  assert.equal(deck.cards[0].category, '42');
});

test('normalizeFlashcardHistory filters unusable decks', () => {
  const history = normalizeFlashcardHistory([
    { id: 'bad', cards: [] },
    { id: 'good', cards: [{ front: 'Q', back: 'A' }] },
  ]);
  assert.deepEqual(history.map((item) => item.id), ['good']);
});

test('normalizeSummary converts a keyword string and fills safe point fields', () => {
  const summary = normalizeSummary({
    document_title: '摘要',
    tldr: '',
    key_points: ['第一個重點', { description: '第二個說明', importance: 'unexpected' }],
    keywords: 'AI、學習, AI',
  });

  assert.equal(summary.tldr, '第一個重點');
  assert.deepEqual(summary.keywords, ['AI', '學習']);
  assert.equal(summary.key_points[1].title, '重點 2');
  assert.equal(summary.key_points[1].importance, '');
});

test('normalizeSummary and history reject blank successful shapes', () => {
  assert.equal(normalizeSummary({ tldr: '', key_points: [], keywords: 'only-keyword' }), null);
  assert.deepEqual(normalizeSummaryHistory([
    { id: 'blank', tldr: '', key_points: [] },
    { id: 'usable', tldr: '有內容', key_points: [], keywords: null },
  ]).map((item) => item.id), ['usable']);
});
