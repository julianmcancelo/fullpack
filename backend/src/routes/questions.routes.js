const express = require('express');
const router = express.Router();
const { getReceivedQuestions, answerQuestion } = require('../services/mlQuestions.service');
const { optionalSession } = require('../middleware/session');
const { resolveMlEmail } = require('../middleware/mlContext');

// Resuelve la cuenta de ML del llamante (sesión web o dispositivo móvil).
router.use(optionalSession);
const mlCtx = (req) => ({ email: resolveMlEmail(req) });

// GET /api/questions
router.get('/', async (req, res) => {
  try {
    const status = req.query.status || 'UNANSWERED';
    const data = await getReceivedQuestions(status, mlCtx(req));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// POST /api/questions/:id/answer
router.post('/:id/answer', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'El texto de la respuesta no puede estar vacío.' });
    }
    const result = await answerQuestion(req.params.id, text.trim(), mlCtx(req));
    res.json({ success: true, result });
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    res.status(400).json({ error: `Error al responder pregunta: ${msg}` });
  }
});

module.exports = router;
