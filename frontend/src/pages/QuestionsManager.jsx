import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
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
    <div className="page">

      {/* Header */}
      <div className="page-head">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title">Preguntas de Compradores</h1>
            {unansweredCount > 0 && (
              <span className="badge badge-warning">
                <Clock className="h-3 w-3" />
                <span className="tabular">{unansweredCount}</span> pendientes
              </span>
            )}
          </div>
          <p className="page-sub">
            Responde las dudas de tus compradores en tiempo real para aumentar tus conversiones.
          </p>
        </div>

        <div className="toolbar">
          <button onClick={loadQuestions} className="btn btn-outline btn-sm">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar Preguntas</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-bold ${
            feedback.type === 'success'
              ? 'border-success/30 bg-success-soft text-success'
              : 'border-danger/30 bg-danger-soft text-danger'
          }`}
        >
          <span className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </span>
          <button
            onClick={() => setFeedback(null)}
            aria-label="Cerrar aviso"
            title="Cerrar aviso"
            className="-m-1 rounded-lg p-1 transition hover:opacity-70"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="toolbar">
        <div className="segmented">
          {[
            { id: 'UNANSWERED', label: 'Sin Responder (Pendientes)' },
            { id: 'ALL', label: 'Historial Completo de Preguntas' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`segmented-btn ${statusFilter === tab.id ? 'segmented-btn-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Questions Feed */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4" aria-busy="true">
            <p className="sr-only">Consultando preguntas de Mercado Libre…</p>

            <div className="card">
              <div className="card-head">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="skeleton h-10 w-10 rounded-xl" />
                  <div className="w-40 space-y-2">
                    <div className="skeleton h-3 w-full" />
                    <div className="skeleton h-2.5 w-2/3" />
                  </div>
                </div>
                <div className="skeleton h-5 w-24 rounded-full" />
              </div>
              <div className="card-body space-y-3">
                <div className="skeleton h-3 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="skeleton h-10 w-10 rounded-xl" />
                  <div className="w-52 space-y-2">
                    <div className="skeleton h-3 w-full" />
                    <div className="skeleton h-2.5 w-1/2" />
                  </div>
                </div>
                <div className="skeleton h-5 w-24 rounded-full" />
              </div>
              <div className="card-body space-y-3">
                <div className="skeleton h-3 w-2/3" />
                <div className="skeleton h-3 w-1/3" />
              </div>
            </div>
          </div>
        ) : questions.length > 0 ? (
          questions.map((q) => {
            const isUnanswered = q.status === 'UNANSWERED';
            const draft = answerDrafts[q.id] || '';
            const isSending = sendingId === q.id;

            return (
              <div
                key={q.id}
                className={`card card-hover overflow-hidden ${
                  isUnanswered ? 'border-warning/40' : ''
                }`}
              >
                {/* Product Context Banner */}
                <div className="card-head">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-muted">
                      {q.item?.thumbnail ? (
                        <img src={q.item.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-4 h-4 text-ink-subtle" />
                      )}
                    </div>
                    <span className="truncate font-display text-sm font-bold text-ink">
                      {q.item?.title || `Publicación #${q.item_id}`}
                    </span>
                  </div>

                  <span className={`badge ${isUnanswered ? 'badge-warning' : 'badge-success'}`}>
                    {isUnanswered ? (
                      <Clock className="h-3 w-3" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    {isUnanswered ? 'Sin responder' : 'Respondida'}
                  </span>
                </div>

                {/* Question Body */}
                <div className="card-body space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-muted text-ink-muted">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-ink-subtle">
                        Pregunta del Comprador
                      </span>
                      <p className="mt-1 text-sm font-semibold leading-relaxed text-ink">
                        "{q.text}"
                      </p>
                    </div>
                  </div>

                  {/* Answer (if already answered) */}
                  {q.answer?.text && (
                    <div className="rounded-2xl border border-success/30 bg-success-soft p-3.5 sm:ml-12">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-success">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Tu Respuesta</span>
                        <span className="tabular font-medium normal-case tracking-normal text-ink-subtle">
                          ({formatDate(q.answer.date_created)})
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-ink">
                        {q.answer.text}
                      </p>
                    </div>
                  )}

                  {/* Answer Input (if unanswered) */}
                  {isUnanswered && (
                    <div className="space-y-2 sm:ml-12">
                      <div className="field">
                        <label className="label">Tu Respuesta</label>
                        <textarea
                          rows={2}
                          placeholder="Escribe tu respuesta aquí para responderle en Mercado Libre..."
                          value={draft}
                          onChange={(e) =>
                            setAnswerDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))
                          }
                          className="textarea"
                        />
                        <p className="help">
                          Se publica en Mercado Libre apenas la envíes y queda guardada en el historial.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card foot: date + actions */}
                <div className="card-foot">
                  <span className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="tabular">{formatDate(q.date_created)}</span>
                  </span>

                  {isUnanswered && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() =>
                          setAnswerDrafts((prev) => {
                            const copy = { ...prev };
                            delete copy[q.id];
                            return copy;
                          })
                        }
                        className="btn btn-outline btn-sm"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Cancelar</span>
                      </button>

                      <button
                        onClick={() => handleSendAnswer(q.id)}
                        disabled={isSending || !draft.trim()}
                        className="btn btn-primary btn-sm"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isSending ? 'Enviando...' : 'Responder en Mercado Libre'}</span>
                      </button>
                    </div>
                  )}
                </div>

              </div>
            );
          })
        ) : (
          <div className="card">
            <div className="empty">
              <div className="empty-icon">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
              <p className="empty-title">¡Genial! No tienes preguntas pendientes por responder.</p>
              <p className="empty-text">
                Cuando un comprador te consulte, la pregunta va a aparecer acá para que puedas
                responderla al instante.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
