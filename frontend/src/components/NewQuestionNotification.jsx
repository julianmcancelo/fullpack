import React from 'react';
import { MessageSquare, X, Reply } from 'lucide-react';

export default function NewQuestionNotification({ question, onClose, onViewQuestions }) {
  if (!question) return null;

  const itemTitle =
    question.item?.title ||
    (question.item_id ? `Publicación #${question.item_id}` : 'Publicación de Mercado Libre');
  const buyer = question.from?.nickname || question.from?.id
    ? question.from?.nickname || `Comprador #${question.from?.id}`
    : null;

  return (
    <div className="fixed bottom-20 right-4 left-4 z-50 animate-slide-down sm:left-auto sm:w-96 md:bottom-6">
      <div className="card card-accent overflow-hidden border-accent/40 shadow-pop">
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="kpi-icon kpi-icon-accent shrink-0">
              <MessageSquare className="h-5 w-5 animate-bounce" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="badge badge-info">
                  <MessageSquare className="h-3 w-3" />
                  Nueva pregunta
                </span>
              </div>

              <h4 className="mt-2 line-clamp-1 font-display text-sm font-extrabold tracking-tight text-ink">
                {itemTitle}
              </h4>

              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                “{question.text || 'Te hicieron una pregunta nueva.'}”
              </p>

              {buyer && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
                  <span className="badge badge-neutral">{buyer}</span>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    if (onViewQuestions) onViewQuestions(question);
                    if (onClose) onClose();
                  }}
                  className="btn btn-primary btn-sm"
                >
                  <Reply className="h-3.5 w-3.5" />
                  Responder ahora
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Cerrar la notificación de pregunta"
            title="Cerrar"
            className="btn btn-ghost btn-icon-sm shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
