import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ExternalLink,
  Package,
  Calendar,
  X
} from 'lucide-react';
import { api } from '../services/api';

export default function QuestionsManager({ connection }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('UNANSWERED'); // UNANSWERED, ALL
  const [answerDrafts, setAnswerDrafts] = useState({}); // { [qId]: text }
  const [sendingId, setSendingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const res = await api.getQuestions(statusFilter);
      setQuestions(res.questions || []);
    } catch (err) {
      console.error('Error al cargar preguntas:', err);
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, [statusFilter]);

  const handleSendAnswer = async (questionId) => {
    const text = answerDrafts[questionId];
    if (!text || !text.trim()) return;

    try {
      setSendingId(questionId);
      setFeedback(null);
      await api.answerQuestion(questionId, text);
      setFeedback({ type: 'success', text: '¡Respuesta enviada a Mercado Libre con éxito!' });

      // Update local state
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === questionId
            ? { ...q, status: 'ANSWERED', answer: { text, date_created: new Date().toISOString() } }
            : q
        )
      );

      setAnswerDrafts((prev) => {
        const copy = { ...prev };
        delete copy[questionId];
        return copy;
      });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSendingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const unansweredCount = questions.filter(q => q.status === 'UNANSWERED').length;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Preguntas de Compradores</h1>
            {unansweredCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-black text-xs">
                {unansweredCount} pendientes
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Responde las dudas de tus compradores en tiempo real para aumentar tus conversiones.
          </p>
        </div>

        <button
          onClick={loadQuestions}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold flex items-center space-x-2 transition shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-yellow-600' : ''}`} />
          <span>Actualizar Preguntas</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-xs font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="border-b border-slate-200 flex items-center space-x-6">
        {[
          { id: 'UNANSWERED', label: 'Sin Responder (Pendientes)' },
          { id: 'ALL', label: 'Historial Completo de Preguntas' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`pb-3 text-xs md:text-sm font-bold transition relative ${
              statusFilter === tab.id
                ? 'text-slate-900 border-b-2 border-yellow-400 -mb-[2px]'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Questions Feed */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-yellow-500" />
            <p className="text-xs">Consultando preguntas de Mercado Libre...</p>
          </div>
        ) : questions.length > 0 ? (
          questions.map((q) => {
            const isUnanswered = q.status === 'UNANSWERED';
            const draft = answerDrafts[q.id] || '';
            const isSending = sendingId === q.id;

            return (
              <div
                key={q.id}
                className={`bg-white rounded-2xl border shadow-sm p-5 transition ${
                  isUnanswered ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-200'
                }`}
              >
                {/* Product Context Banner */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden">
                      {q.item?.thumbnail ? (
                        <img src={q.item.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <span className="font-bold text-slate-800 truncate">
                      {q.item?.title || `Publicación #${q.item_id}`}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0 text-slate-400 text-[11px]">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(q.date_created)}</span>
                    </span>
                  </div>
                </div>

                {/* Question Body */}
                <div className="mt-3.5 space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-slate-100 rounded-xl text-slate-700 font-bold text-xs shrink-0">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase">Pregunta del Comprador:</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5 leading-relaxed">
                        "{q.text}"
                      </p>
                    </div>
                  </div>

                  {/* Answer (if already answered) */}
                  {q.answer?.text && (
                    <div className="ml-10 p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs space-y-1">
                      <div className="flex items-center space-x-1.5 text-emerald-800 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Tu Respuesta:</span>
                        <span className="text-[10px] text-emerald-600 font-normal">({formatDate(q.answer.date_created)})</span>
                      </div>
                      <p className="text-slate-800 leading-relaxed pl-5">
                        {q.answer.text}
                      </p>
                    </div>
                  )}

                  {/* Answer Input (if unanswered) */}
                  {isUnanswered && (
                    <div className="ml-10 pt-2 space-y-2">
                      <div className="relative">
                        <textarea
                          rows={2}
                          placeholder="Escribe tu respuesta aquí para responderle en Mercado Libre..."
                          value={draft}
                          onChange={(e) =>
                            setAnswerDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))
                          }
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={() => handleSendAnswer(q.id)}
                          disabled={isSending || !draft.trim()}
                          className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition flex items-center space-x-2 shadow-sm"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{isSending ? 'Enviando...' : 'Enviar Respuesta a Mercado Libre'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                </div>

              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-sm">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-emerald-500" />
            <p className="text-xs text-emerald-700 font-medium">
              ¡Genial! No tienes preguntas pendientes por responder.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
