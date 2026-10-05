const axios = require('axios');
const { getAuth, getAuthAsync } = require('../db/store');
const { getValidAccessToken } = require('./mlAuth.service');

const ML_API_BASE = 'https://api.mercadolibre.com';

async function getReceivedQuestions(status = 'UNANSWERED', ctx = {}) {
  const token = await getValidAccessToken(ctx.email);
  const auth = ctx.email ? await getAuthAsync(ctx.email) : getAuth();
  if (!token || !auth.userId) {
    throw new Error('Debes conectar tu cuenta de Mercado Libre primero.');
  }

  const params = {
    seller_id: auth.userId,
    sort_fields: 'date_created',
    sort_types: 'DESC',
    limit: 50,
  };
  if (status && status !== 'ALL') {
    params.status = status;
  }

  const res = await axios.get(`${ML_API_BASE}/my/received_questions/search`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });

  const questions = res.data.questions || [];
  
  // Also enrich with item titles if item_id is present
  const itemIds = [...new Set(questions.map(q => q.item_id).filter(Boolean))];
  const itemMap = {};

  if (itemIds.length > 0) {
    for (let i = 0; i < itemIds.length; i += 20) {
      const chunk = itemIds.slice(i, i + 20);
      try {
        const itemRes = await axios.get(`${ML_API_BASE}/items`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { ids: chunk.join(','), attributes: 'id,title,thumbnail,price' },
        });
        itemRes.data.forEach(entry => {
          if (entry.code === 200 && entry.body) {
            itemMap[entry.body.id] = entry.body;
          }
        });
      } catch (err) {
        console.warn('Could not enrich questions with item data:', err.message);
      }
    }
  }

  const enriched = questions.map(q => ({
    ...q,
    item: itemMap[q.item_id] || { id: q.item_id, title: `Publicación #${q.item_id}` },
  }));

  return {
    questions: enriched,
    total: res.data.total || enriched.length,
    unanswered_count: res.data.unanswered || 0,
  };
}

async function answerQuestion(questionId, answerText, ctx = {}) {
  const token = await getValidAccessToken(ctx.email);
  if (!token) {
    throw new Error('Debes conectar tu cuenta de Mercado Libre primero.');
  }

  const res = await axios.post(
    `${ML_API_BASE}/answers`,
    {
      question_id: questionId,
      text: answerText,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return res.data;
}

module.exports = {
  getReceivedQuestions,
  answerQuestion,
};
